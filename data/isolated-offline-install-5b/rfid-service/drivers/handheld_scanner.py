# ==============================================================================
# SmartLib RFID Middleware — Handheld Scanner Driver
# Simulates a mobile RFID wand used for bulk shelf inventory (50+ tags/sec).
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
    lookup_epc,
    random_rssi,
    pick_random_shelf_items,
)
from schemas import (
    InventoryScanResult,
    HandheldScanResponse,
    ScanStatus,
)

log = get_logger(__name__)
settings = get_settings()


def simulate_shelf_scan(
    target_shelf: str,
    tag_count: int = 10,
    epc_list: Optional[list[str]] = None,
    session_id: Optional[str] = None,
    device_id: Optional[str] = None,
) -> HandheldScanResponse:
    """
    [MOCK EMULATOR] Simulate a handheld RFID wand shelf scan.
    
    Generates a realistic inventory scan result including:
    - VERIFIED items (found on correct shelf)
    - MISPLACED items (on wrong shelf)
    - UNCATALOGED items (unknown tags)
    - MISSING items (expected but not found)
    
    Args:
        target_shelf: shelf identifier being scanned (e.g., 'STACK-B/AISLE-04/SHELF-02')
        tag_count: total number of tags to simulate in the batch
        epc_list: specific EPCs to scan; if None, mock data is generated
        session_id: inventory session ID from the backend
        device_id: override device ID
    
    Returns:
        HandheldScanResponse with full reconciliation results
    """
    t_start = time.monotonic()
    dev_id = device_id or settings.handheld_device_id
    evt_id = str(uuid.uuid4())
    sess_id = session_id or str(uuid.uuid4())

    items: list[InventoryScanResult] = []
    counters = {"VERIFIED": 0, "MISPLACED": 0, "MISSING": 0, "UNCATALOGED": 0}
    duplicate_count = 0

    def _feedback_for_status(st: str) -> tuple[str, str]:
        if st == "VERIFIED":
            return ("GREEN_LED_FLASH", "SINGLE_BEEP_2000HZ_40MS")
        if st == "MISPLACED":
            return ("AMBER_LED_BLINK", "DOUBLE_BEEP_800HZ_120MS")
        if st == "UNCATALOGED":
            return ("RED_LED_PULSE", "TRIPLE_CHIME_500HZ")
        return ("SLATE_LED_HOLD", "SILENT_LOG")

    if epc_list:
        seen_epcs: set[str] = set()
        unique_epcs: list[str] = []
        for raw_epc in epc_list:
            norm = raw_epc.strip().upper()
            if norm in seen_epcs:
                duplicate_count += 1
            else:
                seen_epcs.add(norm)
                unique_epcs.append(norm)

        # Use deduplicated EPCs and determine their status
        for epc in unique_epcs:
            catalog = lookup_epc(epc)
            if catalog:
                expected = catalog.get("shelf_location", target_shelf)
                if expected == target_shelf:
                    status = ScanStatus.VERIFIED
                else:
                    status = ScanStatus.MISPLACED
            else:
                expected = None
                status = ScanStatus.UNCATALOGED

            st_val = status.value if hasattr(status, "value") else str(status)
            vis, aud = _feedback_for_status(st_val)
            item = InventoryScanResult(
                rfid_epc=epc,
                accession_number=catalog["accession_number"] if catalog else None,
                book_title=catalog["book_title"] if catalog else None,
                expected_shelf=expected,
                scanned_shelf=target_shelf,
                scan_status=status,
                rssi_dbm=random_rssi(),
                visible_indicator=vis,
                audible_alert=aud,
            )
            items.append(item)
            counters[st_val] += 1

    else:
        # Use mock data generator
        scanned_items, missing_items = pick_random_shelf_items(target_shelf, tag_count)

        for raw in scanned_items:
            status_str = raw.get("scan_status", "UNCATALOGED")
            vis, aud = _feedback_for_status(status_str)
            item = InventoryScanResult(
                rfid_epc=raw["epc"],
                accession_number=raw.get("accession_number"),
                book_title=raw.get("book_title"),
                expected_shelf=raw.get("expected_shelf") or raw.get("shelf_location"),
                scanned_shelf=target_shelf,
                scan_status=ScanStatus(status_str),
                rssi_dbm=random_rssi(),
                visible_indicator=vis,
                audible_alert=aud,
            )
            items.append(item)
            counters[status_str] += 1

        # Add MISSING entries for expected-but-not-scanned items
        for missing_raw in missing_items:
            vis, aud = _feedback_for_status("MISSING")
            item = InventoryScanResult(
                rfid_epc=missing_raw["epc"],
                accession_number=missing_raw.get("accession_number"),
                book_title=missing_raw.get("book_title"),
                expected_shelf=missing_raw.get("shelf_location"),
                scanned_shelf=target_shelf,
                scan_status=ScanStatus.MISSING,
                rssi_dbm=0.0,
                visible_indicator=vis,
                audible_alert=aud,
            )
            items.append(item)
            counters["MISSING"] += 1

    scan_duration_ms = int((time.monotonic() - t_start) * 1000) + random.randint(50, 400)

    has_anomalies = (counters["MISPLACED"] + counters["MISSING"] + counters["UNCATALOGED"]) > 0
    handheld_confirmation = {
        "visible_led": "AMBER_WARNING_BLINK" if has_anomalies else "GREEN_SOLID_OK",
        "audible_beep": "DOUBLE_ATTENTION_TONE" if has_anomalies else "SINGLE_SUCCESS_CHIME",
        "screen_banner": (
            f"Sweep Complete: {counters['VERIFIED']} Verified, {counters['MISPLACED']} Misplaced, "
            f"{counters['MISSING']} Missing, {duplicate_count} Duplicates Filtered"
        ),
    }

    log.info(
        "driver.handheld",
        event_id=evt_id,
        device_id=dev_id,
        session_id=sess_id,
        target_shelf=target_shelf,
        total=len(items),
        duplicate_count=duplicate_count,
        verified=counters["VERIFIED"],
        misplaced=counters["MISPLACED"],
        missing=counters["MISSING"],
        uncataloged=counters["UNCATALOGED"],
        mock_emulator=True,
    )

    return HandheldScanResponse(
        event_id=evt_id,
        session_id=sess_id,
        device_id=dev_id,
        target_shelf=target_shelf,
        total_scanned=len(items),
        duplicate_count=duplicate_count,
        verified=counters["VERIFIED"],
        misplaced=counters["MISPLACED"],
        missing=counters["MISSING"],
        uncataloged=counters["UNCATALOGED"],
        handheld_confirmation=handheld_confirmation,
        items=items,
        scan_duration_ms=scan_duration_ms,
        timestamp=datetime.now(timezone.utc),
        mock_emulator=True,
    )

