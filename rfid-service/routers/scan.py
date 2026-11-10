# ==============================================================================
# SmartLib RFID Middleware — Scan Endpoints Router
# POST /devices/staff-station/scan  — staff desk antenna read
# POST /devices/handheld/scan       — handheld bulk shelf scan
# POST /devices/security-gate/event — gate transit event
# ==============================================================================

from fastapi import APIRouter

from config import get_settings
from logger import get_logger
from schemas import (
    StaffStationScanRequest,
    StaffStationScanResponse,
    HandheldScanRequest,
    HandheldScanResponse,
    GateEventRequest,
    GateEventResponse,
    ProcessingStatus,
)
from drivers import staff_station, handheld_scanner, security_gate
from buffer import offline_sync
from backend_client import post_gate_event_to_backend

router = APIRouter(tags=["Scan Operations"])
log = get_logger(__name__)
settings = get_settings()


# ---------------------------------------------------------------------------
# Staff Station
# ---------------------------------------------------------------------------

@router.post(
    "/devices/staff-station/scan",
    response_model=StaffStationScanResponse,
    summary="Simulate staff desk RFID antenna read",
)
async def staff_station_scan(request: StaffStationScanRequest) -> StaffStationScanResponse:
    """
    **[MOCK EMULATOR]** Simulates a staff desk RFID reader scanning 1–5 book tags
    placed on the antenna pad simultaneously.

    - Identifies known catalog tags by EPC lookup
    - Detects duplicate tag reads within the session window
    - Returns EAS state, book metadata, and RSSI signal strength per tag
    - Marks duplicate reads clearly (`duplicate: true`)

    In production, this endpoint would bridge to real Feig/Zebra USB HF/UHF
    reader hardware via serial or USB-HID protocol.
    """
    result = staff_station.simulate_scan(
        tag_count=request.tag_count,
        epc_list=request.epc_list,
        device_id=request.device_id,
    )
    return result


# ---------------------------------------------------------------------------
# Handheld Scanner
# ---------------------------------------------------------------------------

@router.post(
    "/devices/handheld/scan",
    response_model=HandheldScanResponse,
    summary="Simulate handheld wand bulk shelf scan",
)
async def handheld_scan(request: HandheldScanRequest) -> HandheldScanResponse:
    """
    **[MOCK EMULATOR]** Simulates a handheld RFID wand performing a bulk
    inventory sweep of a library shelf.

    - Detects all RFID tags within antenna range (up to 100 per batch)
    - Reconciles scanned items against expected shelf locations:
        - `VERIFIED` — found on correct shelf
        - `MISPLACED` — found on wrong shelf
        - `MISSING` — expected but not detected
        - `UNCATALOGED` — unknown tag with no catalog record
    - Returns per-item RSSI, shelf location delta, and accession number

    In production, this bridges to Chainway C72 handheld Bluetooth/TCP stream.
    """
    result = handheld_scanner.simulate_shelf_scan(
        target_shelf=request.target_shelf,
        tag_count=request.tag_count,
        epc_list=request.epc_list,
        session_id=request.session_id,
        device_id=request.device_id,
    )
    return result


# ---------------------------------------------------------------------------
# Security Gate
# ---------------------------------------------------------------------------

@router.post(
    "/devices/security-gate/event",
    response_model=GateEventResponse,
    summary="Simulate security gate transit event",
)
async def security_gate_event(request: GateEventRequest) -> GateEventResponse:
    """
    **[MOCK EMULATOR]** Simulates a dual-pedestal security gate detecting
    a tagged item passing through the exit.

    **EAS Logic:**
    - `eas_armed = false` (item properly issued) → transit authorized, green indicator
    - `eas_armed = true` (item not issued or restricted) → alarm triggered, siren + strobe

    **Offline buffering:** If the backend Express API is unreachable, the event
    is persisted to the local SQLite buffer with the original hardware timestamp
    and will be replayed upon reconnection.

    **Footfall tracking:** Each transit increments the internal session footfall
    counter. A CCTV timestamp reference token is generated for DVR correlation.

    In production, this bridges to the Impinj Speedway LLRP gate controller.
    """
    # Generate gate event from mock driver
    result = security_gate.simulate_gate_event(
        rfid_epc=request.rfid_epc,
        force_alarm=request.force_alarm,
        footfall_count=request.footfall_count,
        direction=request.direction,
        device_id=request.device_id,
    )

    # Build payload for backend submission
    payload = {
        "event_id": result.event_id,
        "device_id": result.device_id,
        "rfid_epc": result.rfid_epc,
        "accession_number": result.accession_number,
        "eas_armed": result.eas_armed,
        "alarm_triggered": result.alarm_triggered,
        "unauthorized_item_detected": result.unauthorized_item_detected,
        "offline_security_bit_read": result.offline_security_bit_read,
        "alarm_reason": result.alarm_reason,
        "direction": result.direction,
        "footfall_count": result.footfall_count,
        "cctv_timestamp_ref": result.cctv_timestamp_ref,
        "cctv_snapshot_svg_uri": result.cctv_snapshot_svg_uri,
        "hardware_timestamp": result.hardware_timestamp.isoformat(),
        "mock_emulator": True,
    }

    # Check for duplicate in buffer before posting
    is_dup = await offline_sync.is_duplicate_event(result.event_id)
    if is_dup:
        log.warning(
            "gate_event.duplicate",
            event_id=result.event_id,
            action="rejected",
        )
        result.processing_status = ProcessingStatus.DUPLICATE
        return result

    # Try to post to backend
    posted = await post_gate_event_to_backend(payload)

    if posted:
        result.processing_status = ProcessingStatus.SYNCED
        result.buffered_offline = False
        log.info(
            "gate_event.synced",
            event_id=result.event_id,
            alarm=result.alarm_triggered,
        )
    else:
        # Backend unavailable — buffer offline
        buffered = await offline_sync.buffer_gate_event(
            event_id=result.event_id,
            rfid_epc=result.rfid_epc,
            device_id=result.device_id,
            device_type="SECURITY_GATE",
            hardware_timestamp=result.hardware_timestamp,
            payload=payload,
            accession_number=result.accession_number,
            event_type="GATE_TRANSIT" if not result.alarm_triggered else "GATE_ALARM",
        )
        result.processing_status = ProcessingStatus.PENDING
        result.buffered_offline = True
        log.warning(
            "gate_event.buffered",
            event_id=result.event_id,
            buffered=buffered,
            alarm=result.alarm_triggered,
        )

    return result

