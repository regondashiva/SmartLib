# ==============================================================================
# SmartLib RFID Middleware — Pydantic Schemas
# All request/response models for the RFID service API
# ==============================================================================

from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field
import uuid


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class DeviceType(str, Enum):
    STAFF_STATION = "STAFF_STATION"
    HANDHELD_READER = "HANDHELD_READER"
    SECURITY_GATE = "SECURITY_GATE"


class DeviceStatus(str, Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    MAINTENANCE = "MAINTENANCE"
    ERROR = "ERROR"


class EventType(str, Enum):
    TAG_READ = "TAG_READ"
    TAG_ENCODE = "TAG_ENCODE"
    TAG_BIND = "TAG_BIND"
    BULK_SCAN = "BULK_SCAN"
    GATE_TRANSIT = "GATE_TRANSIT"
    GATE_ALARM = "GATE_ALARM"
    INVENTORY_SCAN = "INVENTORY_SCAN"
    HEARTBEAT = "HEARTBEAT"
    DUPLICATE_REJECTED = "DUPLICATE_REJECTED"


class ProcessingStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSED = "PROCESSED"
    SYNCED = "SYNCED"
    FAILED = "FAILED"
    DUPLICATE = "DUPLICATE"


class ScanStatus(str, Enum):
    VERIFIED = "VERIFIED"
    MISPLACED = "MISPLACED"
    MISSING = "MISSING"
    UNCATALOGED = "UNCATALOGED"


class TagType(str, Enum):
    HF_ISO15693 = "HF_ISO15693"
    HF_ISO14443A = "HF_ISO14443A"
    UHF_EPC_GEN2 = "UHF_EPC_GEN2"


# ---------------------------------------------------------------------------
# Base Event Schema
# ---------------------------------------------------------------------------

class RFIDEvent(BaseModel):
    """Core RFID event structure — attached to every device event."""
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rfid_epc: str = Field(..., description="96-bit EPC hex string (SGTIN-96 format)")
    device_id: str
    device_type: DeviceType
    accession_number: Optional[str] = None
    event_type: EventType
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"use_enum_values": True}


# ---------------------------------------------------------------------------
# Device Schemas
# ---------------------------------------------------------------------------

class DeviceInfo(BaseModel):
    device_id: str
    device_type: DeviceType
    name: str
    location: str
    status: DeviceStatus
    mock_emulator: bool = True
    firmware_version: Optional[str] = None
    last_heartbeat: Optional[datetime] = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"use_enum_values": True}


class DeviceListResponse(BaseModel):
    devices: list[DeviceInfo]
    total: int
    mock_mode: bool = True


class DeviceStatusResponse(BaseModel):
    devices: list[DeviceInfo]
    all_online: bool
    mock_mode: bool = True
    checked_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Staff Station Schemas
# ---------------------------------------------------------------------------

class StaffStationScanRequest(BaseModel):
    """
    Request to simulate a staff station antenna read.
    Optionally provide specific EPCs; otherwise random ones are generated.
    """
    tag_count: int = Field(default=1, ge=1, le=5, description="Number of tags to simulate (1-5)")
    epc_list: Optional[list[str]] = Field(
        default=None,
        description="Specific EPC hex strings to scan; if omitted, mock data is used"
    )
    device_id: Optional[str] = None


class TagReadResult(BaseModel):
    rfid_epc: str
    tag_type: TagType
    rssi_dbm: float
    read_count: int = 1
    book_item: Optional[dict[str, Any]] = None
    is_known: bool = False
    eas_armed: Optional[bool] = None
    duplicate: bool = False

    model_config = {"use_enum_values": True}


class StaffStationScanResponse(BaseModel):
    event_id: str
    device_id: str
    device_type: str = DeviceType.STAFF_STATION
    tags_detected: int
    tags: list[TagReadResult]
    scan_duration_ms: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    mock_emulator: bool = True


# ---------------------------------------------------------------------------
# Handheld Reader Schemas
# ---------------------------------------------------------------------------

class HandheldScanRequest(BaseModel):
    """
    Request to simulate a bulk shelf inventory scan by handheld wand.
    """
    target_shelf: str = Field(..., description="Shelf identifier, e.g. STACK-B/AISLE-04/SHELF-02")
    tag_count: int = Field(default=10, ge=1, le=100, description="Number of tags to simulate")
    epc_list: Optional[list[str]] = Field(default=None, description="Specific EPCs; mock used if omitted")
    session_id: Optional[str] = None
    device_id: Optional[str] = None


class InventoryScanResult(BaseModel):
    rfid_epc: str
    accession_number: Optional[str] = None
    book_title: Optional[str] = None
    expected_shelf: Optional[str] = None
    scanned_shelf: str
    scan_status: ScanStatus
    rssi_dbm: float
    visible_indicator: Optional[str] = None
    audible_alert: Optional[str] = None

    model_config = {"use_enum_values": True}


class HandheldScanResponse(BaseModel):
    event_id: str
    session_id: str
    device_id: str
    device_type: str = DeviceType.HANDHELD_READER
    target_shelf: str
    total_scanned: int
    duplicate_count: int = 0
    verified: int
    misplaced: int
    missing: int
    uncataloged: int
    handheld_confirmation: dict[str, Any] = Field(default_factory=dict)
    items: list[InventoryScanResult]
    scan_duration_ms: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    mock_emulator: bool = True


# ---------------------------------------------------------------------------
# Security Gate Schemas
# ---------------------------------------------------------------------------

class GateEventRequest(BaseModel):
    """
    Request to simulate a security gate transit event.
    """
    rfid_epc: Optional[str] = Field(
        default=None,
        description="Specific EPC to test; if omitted, a random scenario is chosen"
    )
    force_alarm: Optional[bool] = Field(
        default=None,
        description="Force alarm=True for testing; None = auto-detect from EAS state"
    )
    footfall_count: Optional[int] = Field(default=None, description="Simulated footfall sensor count")
    direction: str = Field(default="EXIT", description="Footfall transit direction: ENTRY or EXIT")
    device_id: Optional[str] = None


class GateEventResponse(BaseModel):
    event_id: str
    device_id: str
    device_type: str = DeviceType.SECURITY_GATE
    rfid_epc: str
    accession_number: Optional[str] = None
    book_title: Optional[str] = None
    eas_armed: bool
    alarm_triggered: bool
    unauthorized_item_detected: bool = False
    offline_security_bit_read: bool = True
    alarm_reason: Optional[str] = None
    direction: str = "EXIT"
    footfall_count: int
    cctv_timestamp_ref: str
    cctv_snapshot_svg_uri: Optional[str] = None
    hardware_timestamp: datetime
    processing_status: ProcessingStatus
    buffered_offline: bool = False
    mock_emulator: bool = True

    model_config = {"use_enum_values": True}


# ---------------------------------------------------------------------------
# Event Queue Schemas
# ---------------------------------------------------------------------------

class BufferedEvent(BaseModel):
    id: int
    event_id: str
    rfid_epc: str
    device_id: str
    device_type: str
    accession_number: Optional[str] = None
    event_type: str
    hardware_timestamp: datetime
    processing_status: str
    payload: dict[str, Any]
    created_at: datetime
    synced_at: Optional[datetime] = None
    sync_attempts: int = 0
    sync_error: Optional[str] = None


class EventListResponse(BaseModel):
    events: list[BufferedEvent]
    total: int
    pending: int
    synced: int
    failed: int


class SyncRequest(BaseModel):
    batch_size: Optional[int] = Field(default=None, description="Override default batch size")
    force_all: bool = Field(default=False, description="Sync all pending events ignoring batch limit")


class SyncResult(BaseModel):
    synced: int
    failed: int
    remaining_pending: int
    duration_ms: int
    errors: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Health Schema
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    mock_hardware: bool
    backend_connected: bool
    backend_url: str
    buffer_path: str
    pending_events: int
    devices_online: int
    uptime_seconds: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)

