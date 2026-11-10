# ==============================================================================
# SmartLib RFID Middleware — Security Gate Driver
# Simulates a dual-pedestal EAS/RFID security gate at library exits.
# Clearly identified as [MOCK EMULATOR] — does NOT control real hardware.
#
# Architecture:
#   Real gate polls at 20 Hz via LLRP/TCP
#   This mock generates a single simulated transit event per API call
#   Gate events are posted to the backend; on failure they go to SQLite buffer
# ==============================================================================

from __future__ import annotations
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

from config import get_settings
from logger import get_logger
from drivers.mock_data import (
    lookup_epc,
    pick_random_catalog_epc,
    random_epc,
    generate_cctv_ref,
)
from schemas import GateEventResponse, ProcessingStatus

log = get_logger(__name__)
settings = get_settings()

# Global simulated footfall counter (resets on service restart)
_footfall_counter: int = 0


def _next_footfall() -> int:
    global _footfall_counter
    _footfall_counter += 1
    return _footfall_counter


def simulate_gate_event(
    rfid_epc: Optional[str] = None,
    force_alarm: Optional[bool] = None,
    footfall_count: Optional[int] = None,
    direction: str = "EXIT",
    device_id: Optional[str] = None,
) -> GateEventResponse:
    """
    [MOCK EMULATOR] Simulate a security gate transit event.
    """
    import base64
    dev_id = device_id or settings.security_gate_device_id
    event_id = str(uuid.uuid4())
    hardware_timestamp = datetime.now(timezone.utc)
    footfall = footfall_count if footfall_count is not None else _next_footfall()
    cctv_ref = generate_cctv_ref(dev_id)
    norm_direction = "ENTRY" if str(direction).upper() == "ENTRY" else "EXIT"

    # Determine EPC
    if rfid_epc:
        epc = rfid_epc
    else:
        # Random scenario: 60% chance of picking an armed (un-issued) book
        if random.random() < 0.60:
            epc = pick_random_catalog_epc(armed_only=True)
        else:
            epc = pick_random_catalog_epc(issued_only=True) or random_epc()

    catalog_entry = lookup_epc(epc)
    is_known = catalog_entry is not None
    accession_number = catalog_entry["accession_number"] if is_known else None
    book_title = catalog_entry["book_title"] if is_known else None

    # Determine EAS state and alarm
    if force_alarm is not None:
        eas_armed = force_alarm
        alarm_triggered = force_alarm
    elif is_known:
        eas_armed = catalog_entry["eas_armed"]
        alarm_triggered = eas_armed  # armed → alarm
    else:
        # Unknown tag: treat as armed → alarm
        eas_armed = True
        alarm_triggered = True

    alarm_reason = None
    if alarm_triggered:
        if not is_known:
            alarm_reason = "UNKNOWN_TAG — no catalog record found for this EPC"
        elif catalog_entry.get("issued") is False:
            alarm_reason = (
                "ITEM_NOT_ISSUED — EAS bit armed; item was not checked out through circulation"
            )
        else:
            alarm_reason = "EAS_ARMED — item is restricted (reference-only or manually flagged)"

    stroke_color = "#EF4444" if alarm_triggered else "#10B981"
    status_label = "ALARM: UNAUTHORIZED EXIT" if alarm_triggered else "AUTHORIZED TRANSIT"
    svg_str = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">'
        f'<rect width="480" height="270" fill="#0F172A"/>'
        f'<rect x="12" y="12" width="456" height="246" fill="none" stroke="{stroke_color}" stroke-width="3"/>'
        f'<text x="24" y="40" fill="#F8FAFC" font-family="monospace" font-size="13">[MOCK CCTV] {cctv_ref}</text>'
        f'<text x="24" y="65" fill="{stroke_color}" font-family="monospace" font-size="15" font-weight="bold">{status_label}</text>'
        f'<text x="24" y="95" fill="#CBD5E1" font-family="monospace" font-size="12">EPC: {epc}</text>'
        f'<text x="24" y="120" fill="#CBD5E1" font-family="monospace" font-size="12">ACC: {accession_number or "UNREGISTERED"}</text>'
        f'<text x="24" y="145" fill="#CBD5E1" font-family="monospace" font-size="12">DIR: {norm_direction} | FOOTFALL: #{footfall}</text>'
        f'<text x="24" y="240" fill="#64748B" font-family="monospace" font-size="11">{hardware_timestamp.isoformat()}</text>'
        f'</svg>'
    )
    cctv_svg_uri = "data:image/svg+xml;base64," + base64.b64encode(svg_str.encode("utf-8")).decode("ascii")

    log.info(
        "driver.security_gate",
        event_id=event_id,
        device_id=dev_id,
        epc=epc,
        eas_armed=eas_armed,
        alarm_triggered=alarm_triggered,
        direction=norm_direction,
        footfall=footfall,
        mock_emulator=True,
    )

    return GateEventResponse(
        event_id=event_id,
        device_id=dev_id,
        rfid_epc=epc,
        accession_number=accession_number,
        book_title=book_title,
        eas_armed=eas_armed,
        alarm_triggered=alarm_triggered,
        unauthorized_item_detected=alarm_triggered,
        offline_security_bit_read=True,
        alarm_reason=alarm_reason,
        direction=norm_direction,
        footfall_count=footfall,
        cctv_timestamp_ref=cctv_ref,
        cctv_snapshot_svg_uri=cctv_svg_uri,
        hardware_timestamp=hardware_timestamp,
        processing_status=ProcessingStatus.PENDING,
        buffered_offline=False,
        mock_emulator=True,
    )

