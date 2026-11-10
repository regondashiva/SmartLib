# ==============================================================================
# SmartLib RFID Middleware — Events Router
# GET  /events          — list all buffered events (paginated)
# GET  /events/pending  — list only pending events awaiting sync
# POST /events/sync     — trigger manual sync of pending events to backend
# ==============================================================================

import time
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query

from config import get_settings
from logger import get_logger
from schemas import EventListResponse, BufferedEvent, SyncRequest, SyncResult
from buffer import offline_sync
from backend_client import sync_buffered_event

router = APIRouter(prefix="/events", tags=["Event Queue"])
log = get_logger(__name__)
settings = get_settings()


def _row_to_event(row: dict) -> BufferedEvent:
    """Convert a raw SQLite row dict into a BufferedEvent model."""
    payload = row.get("payload", "{}")
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}

    def _parse_dt(val) -> Optional[datetime]:
        if not val:
            return None
        if isinstance(val, datetime):
            return val
        try:
            return datetime.fromisoformat(val)
        except Exception:
            return None

    return BufferedEvent(
        id=row["id"],
        event_id=row["event_id"],
        rfid_epc=row["rfid_epc"],
        device_id=row["device_id"],
        device_type=row["device_type"],
        accession_number=row.get("accession_number"),
        event_type=row.get("event_type", "GATE_TRANSIT"),
        hardware_timestamp=_parse_dt(row["hardware_timestamp"]) or datetime.utcnow(),
        processing_status=row["processing_status"],
        payload=payload,
        created_at=_parse_dt(row["created_at"]) or datetime.utcnow(),
        synced_at=_parse_dt(row.get("synced_at")),
        sync_attempts=row.get("sync_attempts", 0),
        sync_error=row.get("sync_error"),
    )


@router.get("", response_model=EventListResponse, summary="List all buffered gate events")
async def list_events(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    status: Optional[str] = Query(default=None, description="Filter by status: PENDING, SYNCED, FAILED"),
) -> EventListResponse:
    """
    Returns a paginated list of all gate events in the local SQLite buffer.
    
    Use `status` to filter by processing state:
    - `PENDING` — awaiting sync to backend
    - `SYNCED` — successfully delivered to backend
    - `FAILED` — exceeded retry limit (preserved for diagnosis)
    """
    rows, total = await offline_sync.get_all_events(limit=limit, offset=offset, status=status)
    stats = await offline_sync.get_buffer_stats()

    events = [_row_to_event(r) for r in rows]
    return EventListResponse(
        events=events,
        total=total,
        pending=stats["pending"],
        synced=stats["synced"],
        failed=stats["failed"],
    )


@router.get("/pending", response_model=EventListResponse, summary="List pending events awaiting sync")
async def list_pending_events() -> EventListResponse:
    """
    Returns all gate events that are pending synchronization to the backend.
    
    These events were created while the backend was unreachable and are waiting
    to be replayed with their original hardware timestamps.
    """
    rows = await offline_sync.get_pending_events()
    stats = await offline_sync.get_buffer_stats()

    events = [_row_to_event(r) for r in rows]
    return EventListResponse(
        events=events,
        total=len(events),
        pending=stats["pending"],
        synced=stats["synced"],
        failed=stats["failed"],
    )


@router.post("/sync", response_model=SyncResult, summary="Sync pending events to backend")
async def sync_events(request: SyncRequest = SyncRequest()) -> SyncResult:
    """
    Triggers manual synchronization of pending offline gate events to the backend.
    
    - Fetches pending events from the SQLite buffer (oldest first)
    - Sends each event to the backend Express API
    - Marks successful events as SYNCED
    - Marks failed events (after 5 attempts) as FAILED
    - Preserves original hardware timestamps throughout
    - Prevents re-sending already synced events
    
    Returns a summary of sync results.
    """
    t_start = time.monotonic()
    batch_size = request.batch_size or settings.sync_batch_size
    limit = None if request.force_all else batch_size

    pending = await offline_sync.get_pending_events(limit=limit)

    synced = 0
    failed = 0
    errors: list[str] = []

    for row in pending:
        event_id = row["event_id"]
        payload_raw = row.get("payload", "{}")
        if isinstance(payload_raw, str):
            try:
                payload = json.loads(payload_raw)
            except Exception:
                payload = {}
        else:
            payload = payload_raw

        try:
            success = await sync_buffered_event(payload)
            if success:
                await offline_sync.mark_event_synced(event_id)
                synced += 1
                log.info("sync.event", event_id=event_id, action="synced")
            else:
                await offline_sync.mark_event_failed(event_id, "Backend returned failure")
                failed += 1
                errors.append(f"{event_id}: backend rejected")
        except Exception as exc:
            await offline_sync.mark_event_failed(event_id, str(exc))
            failed += 1
            errors.append(f"{event_id}: {exc}")

    remaining_stats = await offline_sync.get_buffer_stats()
    duration_ms = int((time.monotonic() - t_start) * 1000)

    log.info(
        "sync.complete",
        synced=synced,
        failed=failed,
        remaining_pending=remaining_stats["pending"],
        duration_ms=duration_ms,
    )

    return SyncResult(
        synced=synced,
        failed=failed,
        remaining_pending=remaining_stats["pending"],
        duration_ms=duration_ms,
        errors=errors[:20],  # Limit error list
    )

