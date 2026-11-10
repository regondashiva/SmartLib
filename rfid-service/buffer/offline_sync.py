# ==============================================================================
# SmartLib RFID Middleware — Offline SQLite Event Buffer
# Persists gate events locally when the backend is unavailable.
# Preserves hardware timestamps, prevents duplicates, retries on reconnect.
# ==============================================================================

from __future__ import annotations
import json
import os
from datetime import datetime
from typing import Any, Optional

import aiosqlite

from config import get_settings
from logger import get_logger

log = get_logger(__name__)
settings = get_settings()


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS gate_event_buffer (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id         TEXT    NOT NULL UNIQUE,
    rfid_epc         TEXT    NOT NULL,
    device_id        TEXT    NOT NULL,
    device_type      TEXT    NOT NULL,
    accession_number TEXT,
    event_type       TEXT    NOT NULL DEFAULT 'GATE_TRANSIT',
    hardware_timestamp TEXT  NOT NULL,
    processing_status TEXT  NOT NULL DEFAULT 'PENDING',
    payload          TEXT    NOT NULL,     -- JSON blob
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    synced_at        TEXT,
    sync_attempts    INTEGER NOT NULL DEFAULT 0,
    sync_error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_buffer_status ON gate_event_buffer(processing_status);
CREATE INDEX IF NOT EXISTS idx_buffer_event_id ON gate_event_buffer(event_id);
"""


async def _get_db_path() -> str:
    path = settings.sqlite_buffer_path
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    return path


async def initialize_buffer() -> None:
    """Create the SQLite database and schema if they do not exist."""
    db_path = await _get_db_path()
    async with aiosqlite.connect(db_path) as db:
        await db.executescript(CREATE_TABLE_SQL)
        await db.commit()
    log.info("buffer.init", path=db_path, action="schema_ready")


async def buffer_gate_event(
    event_id: str,
    rfid_epc: str,
    device_id: str,
    device_type: str,
    hardware_timestamp: datetime,
    payload: dict[str, Any],
    accession_number: Optional[str] = None,
    event_type: str = "GATE_TRANSIT",
) -> bool:
    """
    Persist a gate event to the SQLite buffer.
    Returns True if inserted, False if duplicate (event_id already exists).
    """
    db_path = await _get_db_path()
    try:
        async with aiosqlite.connect(db_path) as db:
            # Check for duplicate
            cur = await db.execute(
                "SELECT id FROM gate_event_buffer WHERE event_id = ?", (event_id,)
            )
            row = await cur.fetchone()
            if row:
                log.warning(
                    "buffer.insert",
                    action="duplicate_rejected",
                    event_id=event_id,
                )
                return False

            await db.execute(
                """
                INSERT INTO gate_event_buffer
                    (event_id, rfid_epc, device_id, device_type, accession_number,
                     event_type, hardware_timestamp, processing_status, payload)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
                """,
                (
                    event_id,
                    rfid_epc,
                    device_id,
                    device_type,
                    accession_number,
                    event_type,
                    hardware_timestamp.isoformat(),
                    json.dumps(payload),
                ),
            )
            await db.commit()
        log.info("buffer.insert", action="saved", event_id=event_id)
        return True
    except Exception as exc:
        log.error("buffer.insert", error=str(exc), event_id=event_id)
        return False


async def get_pending_events(limit: Optional[int] = None) -> list[dict[str, Any]]:
    """Fetch all PENDING events from the buffer, oldest first."""
    db_path = await _get_db_path()
    sql = "SELECT * FROM gate_event_buffer WHERE processing_status = 'PENDING' ORDER BY id ASC"
    if limit:
        sql += f" LIMIT {limit}"
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(sql)
        rows = await cur.fetchall()
        return [dict(r) for r in rows]


async def get_all_events(
    limit: int = 200,
    offset: int = 0,
    status: Optional[str] = None,
) -> tuple[list[dict[str, Any]], int]:
    """Fetch events with optional status filter. Returns (rows, total_count)."""
    db_path = await _get_db_path()
    where = "WHERE processing_status = ?" if status else ""
    params_count: list[Any] = [status] if status else []

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        # Count
        cur = await db.execute(
            f"SELECT COUNT(*) FROM gate_event_buffer {where}", params_count
        )
        total = (await cur.fetchone())[0]  # type: ignore[index]

        # Fetch
        params_fetch: list[Any] = params_count + [limit, offset]
        cur = await db.execute(
            f"SELECT * FROM gate_event_buffer {where} ORDER BY id DESC LIMIT ? OFFSET ?",
            params_fetch,
        )
        rows = await cur.fetchall()
        return [dict(r) for r in rows], total


async def mark_event_synced(event_id: str) -> None:
    """Mark a buffered event as SYNCED after successful backend delivery."""
    db_path = await _get_db_path()
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            UPDATE gate_event_buffer
            SET processing_status = 'SYNCED', synced_at = datetime('now')
            WHERE event_id = ?
            """,
            (event_id,),
        )
        await db.commit()
    log.info("buffer.sync", action="marked_synced", event_id=event_id)


async def mark_event_failed(event_id: str, error: str) -> None:
    """Increment retry counter and record sync error on a buffered event."""
    db_path = await _get_db_path()
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            UPDATE gate_event_buffer
            SET sync_attempts = sync_attempts + 1,
                sync_error = ?,
                processing_status = CASE
                    WHEN sync_attempts + 1 >= 5 THEN 'FAILED'
                    ELSE 'PENDING'
                END
            WHERE event_id = ?
            """,
            (error[:500], event_id),
        )
        await db.commit()
    log.warning("buffer.sync", action="sync_failed", event_id=event_id, error=error)


async def get_buffer_stats() -> dict[str, int]:
    """Return counts by processing_status."""
    db_path = await _get_db_path()
    try:
        async with aiosqlite.connect(db_path) as db:
            cur = await db.execute(
                """
                SELECT processing_status, COUNT(*) AS cnt
                FROM gate_event_buffer
                GROUP BY processing_status
                """
            )
            rows = await cur.fetchall()
            stats = {r[0]: r[1] for r in rows}
            return {
                "pending": stats.get("PENDING", 0),
                "synced": stats.get("SYNCED", 0),
                "failed": stats.get("FAILED", 0),
                "total": sum(stats.values()),
            }
    except Exception:
        return {"pending": 0, "synced": 0, "failed": 0, "total": 0}


async def is_duplicate_event(event_id: str) -> bool:
    """Check whether an event_id already exists in the buffer."""
    db_path = await _get_db_path()
    try:
        async with aiosqlite.connect(db_path) as db:
            cur = await db.execute(
                "SELECT 1 FROM gate_event_buffer WHERE event_id = ?", (event_id,)
            )
            return (await cur.fetchone()) is not None
    except Exception:
        return False

