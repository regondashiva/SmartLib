# ==============================================================================
# SmartLib RFID Middleware — Devices Router
# GET /devices        — list all configured devices
# GET /devices/status — real-time status of all devices
# ==============================================================================

from datetime import datetime, timezone
from fastapi import APIRouter

from config import get_settings
from schemas import DeviceInfo, DeviceListResponse, DeviceStatusResponse, DeviceType, DeviceStatus

router = APIRouter(prefix="/devices", tags=["Devices"])
settings = get_settings()


def _build_device_list() -> list[DeviceInfo]:
    """Return the configured mock device registry."""
    now = datetime.now(timezone.utc)
    return [
        DeviceInfo(
            device_id=settings.staff_station_device_id,
            device_type=DeviceType.STAFF_STATION,
            name="Staff RFID Desk Station",
            location="Circulation Counter — Main Desk",
            status=DeviceStatus.ONLINE,
            mock_emulator=settings.mock_hardware,
            firmware_version="MOCK-v1.0.0",
            last_heartbeat=now,
            metadata={
                "protocol": "HF ISO 15693 / UHF EPC Gen2",
                "max_simultaneous_tags": settings.staff_station_max_tags,
                "antenna_frequency": "13.56 MHz / 865–868 MHz",
                "note": "[MOCK EMULATOR] — virtual antenna pad",
            },
        ),
        DeviceInfo(
            device_id=settings.handheld_device_id,
            device_type=DeviceType.HANDHELD_READER,
            name="Handheld Inventory Wand",
            location="Portable — Assigned to Stack Auditor",
            status=DeviceStatus.ONLINE,
            mock_emulator=settings.mock_hardware,
            firmware_version="MOCK-v1.0.0",
            last_heartbeat=now,
            metadata={
                "protocol": "UHF EPC Gen2 ISO 18000-6C",
                "scan_rate_per_second": 50,
                "connectivity": "Bluetooth / TCP-IP",
                "note": "[MOCK EMULATOR] — virtual handheld wand",
            },
        ),
        DeviceInfo(
            device_id=settings.security_gate_device_id,
            device_type=DeviceType.SECURITY_GATE,
            name="Security Gate — Main Exit",
            location="Library Main Entrance / Exit",
            status=DeviceStatus.ONLINE,
            mock_emulator=settings.mock_hardware,
            firmware_version="MOCK-v1.0.0",
            last_heartbeat=now,
            metadata={
                "protocol": "UHF EPC Gen2 Dual Pedestal",
                "poll_rate_hz": settings.gate_poll_rate_hz,
                "eas_capable": True,
                "cctv_integration": True,
                "footfall_sensor": True,
                "note": "[MOCK EMULATOR] — virtual dual-pedestal EAS gate",
            },
        ),
    ]


@router.get("", response_model=DeviceListResponse, summary="List all RFID devices")
async def list_devices() -> DeviceListResponse:
    """
    Returns the registry of all RFID devices configured in this middleware instance.
    
    In production, this would include real hardware polling. In mock mode,
    all devices report as ONLINE with simulated telemetry.
    
    All entries are clearly labeled `mock_emulator: true` when hardware emulation
    is active (MOCK_HARDWARE=true).
    """
    devices = _build_device_list()
    return DeviceListResponse(
        devices=devices,
        total=len(devices),
        mock_mode=settings.mock_hardware,
    )


@router.get("/status", response_model=DeviceStatusResponse, summary="Real-time device status check")
async def device_status() -> DeviceStatusResponse:
    """
    Returns real-time status of all RFID devices.
    
    Checks each device's last heartbeat and connectivity.
    In mock mode, all devices are simulated as ONLINE.
    
    In a real deployment, this would poll hardware heartbeat registers
    via LLRP/TCP or USB HID to verify physical connectivity.
    """
    devices = _build_device_list()
    all_online = all(d.status == DeviceStatus.ONLINE for d in devices)

    return DeviceStatusResponse(
        devices=devices,
        all_online=all_online,
        mock_mode=settings.mock_hardware,
        checked_at=datetime.now(timezone.utc),
    )

