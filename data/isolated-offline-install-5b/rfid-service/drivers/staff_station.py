# ==============================================================================
# SmartLib RFID Middleware — Staff Station Reader Driver
# Simulates a desk-mounted HF/UHF RFID antenna pad (1-5 simultaneous tags).
# Clearly identified as [MOCK EMULATOR] — does NOT control real hardware.
# ==============================================================================

from __future__ import annotations
import random
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from config import get_settings
from logger import get_logger
from drivers.mock_data import (
    EPC_CATALOG,
    lookup_epc,
    random_epc,
    random_rssi,
    pick_random_catalog_epc,
)
from schemas import (
    TagReadResult,
    StaffStationScanResponse,
)

log = get_logger(__name__)
settings = get_settings()

# In-memory duplicate scan protection (session-level)
# Tracks EPCs seen in the last 30 seconds to prevent double-reads
_recent_scans: dict[str, float] = {}
DUPLICATE_WINDOW_SECONDS = 30.0


def reset_duplicate_cache() -> None:
    """Clear recent scan history (useful for tests and session reset)."""
    _recent_scans.clear()


def _is_duplicate(epc: str) -> bool:
    """Return True if this EPC was scanned within the duplicate window."""
    now = time.monotonic()
    # Expire old entries
    expired = [k for k, v in _recent_scans.items() if now - v > DUPLICATE_WINDOW_SECONDS]
    for k in expired:
        del _recent_scans[k]
    return epc in _recent_scans


def _register_scan(epc: str) -> None:
    _recent_scans[epc] = time.monotonic()


def simulate_scan(
    tag_count: int = 1,
    epc_list: Optional[list[str]] = None,
    device_id: Optional[str] = None,
) -> StaffStationScanResponse:
    """
    [MOCK EMULATOR] Simulate a staff station antenna pad read.
    
    - tag_count: how many tags to simulate (1-5)
    - epc_list: specific EPCs to use; if None, mock EPCs are chosen
    - device_id: override device ID
    
    Returns a StaffStationScanResponse with tag details.
    """
    t_start = time.monotonic()
    dev_id = device_id or settings.staff_station_device_id
    event_id = str(uuid.uuid4())

    # Build EPC list
    if epc_list:
        epcs = epc_list[:settings.staff_station_max_tags]
    else:
        # Pick from catalog 70% of the time, random unknown 30%
        epcs = []
        for _ in range(min(tag_count, settings.staff_station_max_tags)):
            if random.random() < 0.70 and EPC_CATALOG:
                epcs.append(pick_random_catalog_epc())
            else:
                epcs.append(random_epc())

    tags: list[TagReadResult] = []
    seen_in_this_scan: set[str] = set()

    for epc in epcs:
        duplicate = False

        # Duplicate detection: same EPC twice in one scan batch
        if epc in seen_in_this_scan:
            duplicate = True
        else:
            seen_in_this_scan.add(epc)

        # Cross-session duplicate (seen recently)
        is_cross_session_dup = _is_duplicate(epc)
        if not duplicate:
            _register_scan(epc)

        catalog_entry = lookup_epc(epc)
        is_known = catalog_entry is not None

        book_item_data = None
        eas_armed = None
        if is_known:
            book_item_data = {
                "accession_number": catalog_entry["accession_number"],
                "book_title": catalog_entry["book_title"],
                "shelf_location": catalog_entry["shelf_location"],
                "issued": catalog_entry["issued"],
                "tag_type": catalog_entry["tag_type"],
            }
            eas_armed = catalog_entry["eas_armed"]

        tag_result = TagReadResult(
            rfid_epc=epc,
            tag_type=catalog_entry["tag_type"] if is_known else "UHF_EPC_GEN2",
            rssi_dbm=random_rssi(),
            read_count=random.randint(1, 3),
            book_item=book_item_data,
            is_known=is_known,
            eas_armed=eas_armed,
            duplicate=duplicate or is_cross_session_dup,
        )
        tags.append(tag_result)

    scan_duration_ms = int((time.monotonic() - t_start) * 1000) + random.randint(5, 50)

    log.info(
        "driver.staff_station",
        event_id=event_id,
        device_id=dev_id,
        tags_detected=len(tags),
        mock_emulator=True,
    )

    return StaffStationScanResponse(
        event_id=event_id,
        device_id=dev_id,
        tags_detected=len(tags),
        tags=tags,
        scan_duration_ms=scan_duration_ms,
        timestamp=datetime.now(timezone.utc),
        mock_emulator=True,
    )

