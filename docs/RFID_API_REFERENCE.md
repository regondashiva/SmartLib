# SmartLib — RFID Middleware REST API Reference

> **Edge Hardware Gateway API Documentation**  
> **Base URL:** `http://localhost:8000`  
> **OpenAPI Docs:** `http://localhost:8000/docs` | **Redoc:** `http://localhost:8000/redoc`  
> **Interactive Swagger:** Available when running `uvicorn main:app --port 8000`

---

## 1. System Endpoints

### `GET /health`
Returns edge middleware telemetry, uptime, offline buffer status, and backend connectivity.

**Response `200 OK`:**
```json
{
  "status": "HEALTHY",
  "service": "smartlib-rfid-middleware",
  "version": "1.0.0-phase2b",
  "mock_hardware": true,
  "backend_connected": true,
  "backend_url": "http://localhost:5000/api/v1",
  "buffer_path": "./data/offline_events.db",
  "pending_events": 0,
  "devices_online": 3,
  "uptime_seconds": 128.45,
  "timestamp": "2026-11-06T14:45:00.000Z"
}
```

---

## 2. Device Management Endpoints

### `GET /devices`
Lists all RFID devices registered with this middleware instance.

**Response `200 OK`:**
```json
{
  "devices": [
    {
      "device_id": "DEV-SS-001",
      "device_type": "STAFF_STATION",
      "name": "Staff RFID Desk Station",
      "location": "Circulation Counter — Main Desk",
      "status": "ONLINE",
      "mock_emulator": true,
      "firmware_version": "MOCK-v1.0.0",
      "last_heartbeat": "2026-11-06T14:45:00.000Z",
      "metadata": {
        "protocol": "HF ISO 15693 / UHF EPC Gen2",
        "max_simultaneous_tags": 5
      }
    },
    {
      "device_id": "DEV-HH-001",
      "device_type": "HANDHELD_READER",
      "name": "Handheld Inventory Wand",
      "location": "Portable — Assigned to Stack Auditor",
      "status": "ONLINE",
      "mock_emulator": true,
      "firmware_version": "MOCK-v1.0.0",
      "last_heartbeat": "2026-11-06T14:45:00.000Z"
    },
    {
      "device_id": "DEV-SG-001",
      "device_type": "SECURITY_GATE",
      "name": "Security Gate — Main Exit",
      "location": "Library Main Entrance / Exit",
      "status": "ONLINE",
      "mock_emulator": true,
      "firmware_version": "MOCK-v1.0.0",
      "last_heartbeat": "2026-11-06T14:45:00.000Z"
    }
  ],
  "total": 3,
  "mock_mode": true
}
```

### `GET /devices/status`
Real-time connectivity and heartbeat status of all devices.

---

## 3. Scan & Transit Endpoints

### `POST /devices/staff-station/scan`
Simulates placing 1 to 5 books onto the desk antenna pad simultaneously.

**Request Body:**
```json
{
  "tag_count": 2,
  "epc_list": [
    "3034257BF4000B4000000001",
    "3034257BF4000B4000000002"
  ],
  "device_id": "DEV-SS-001"
}
```

**Response `200 OK`:**
```json
{
  "event_id": "4a737f22-1d54-4f9e-a89b-89115f5a892e",
  "device_id": "DEV-SS-001",
  "device_type": "STAFF_STATION",
  "tags_detected": 2,
  "tags": [
    {
      "rfid_epc": "3034257BF4000B4000000001",
      "tag_type": "UHF_EPC_GEN2",
      "rssi_dbm": -52.4,
      "read_count": 2,
      "book_item": {
        "accession_number": "ACC-2026-00001",
        "book_title": "Introduction to Algorithms",
        "shelf_location": "STACK-A/AISLE-01/SHELF-03",
        "issued": true,
        "tag_type": "UHF_EPC_GEN2"
      },
      "is_known": true,
      "eas_armed": false,
      "duplicate": false
    },
    {
      "rfid_epc": "3034257BF4000B4000000002",
      "tag_type": "UHF_EPC_GEN2",
      "rssi_dbm": -48.1,
      "read_count": 1,
      "book_item": {
        "accession_number": "ACC-2026-00002",
        "book_title": "Introduction to Algorithms (Reference Copy)",
        "shelf_location": "STACK-A/AISLE-01/SHELF-03",
        "issued": false,
        "tag_type": "UHF_EPC_GEN2"
      },
      "is_known": true,
      "eas_armed": true,
      "duplicate": false
    }
  ],
  "scan_duration_ms": 18,
  "timestamp": "2026-11-06T14:45:00.000Z",
  "mock_emulator": true
}
```

---

### `POST /devices/handheld/scan`
Simulates a mobile shelf inventory wand sweep with automatic catalog reconciliation.

**Request Body:**
```json
{
  "target_shelf": "STACK-A/AISLE-01/SHELF-03",
  "tag_count": 8,
  "session_id": "SESS-2026-10"
}
```

**Response `200 OK`:**
```json
{
  "event_id": "c1f72b22-86ee-4217-ba71-ef62dfbc4953",
  "session_id": "SESS-2026-10",
  "device_id": "DEV-HH-001",
  "device_type": "HANDHELD_READER",
  "target_shelf": "STACK-A/AISLE-01/SHELF-03",
  "total_scanned": 8,
  "verified": 4,
  "misplaced": 1,
  "missing": 1,
  "uncataloged": 2,
  "items": [
    {
      "rfid_epc": "3034257BF4000B4000000001",
      "accession_number": "ACC-2026-00001",
      "book_title": "Introduction to Algorithms",
      "expected_shelf": "STACK-A/AISLE-01/SHELF-03",
      "scanned_shelf": "STACK-A/AISLE-01/SHELF-03",
      "scan_status": "VERIFIED",
      "rssi_dbm": -56.3
    },
    {
      "rfid_epc": "3034257BF4000B4000000007",
      "accession_number": "ACC-2026-00007",
      "book_title": "Computer Networks",
      "expected_shelf": "STACK-D/AISLE-04/SHELF-06",
      "scanned_shelf": "STACK-A/AISLE-01/SHELF-03",
      "scan_status": "MISPLACED",
      "rssi_dbm": -61.2
    }
  ],
  "scan_duration_ms": 142,
  "timestamp": "2026-11-06T14:45:00.000Z",
  "mock_emulator": true
}
```

---

### `POST /devices/security-gate/event`
Simulates a tagged book transiting through the exit security gate.

**Request Body:**
```json
{
  "rfid_epc": "3034257BF4000B4000000002",
  "footfall_count": 105
}
```

**Response `200 OK` (Alarm Triggered):**
```json
{
  "event_id": "2d174a9e-012e-4ec3-bf30-580798e9ce7f",
  "device_id": "DEV-SG-001",
  "device_type": "SECURITY_GATE",
  "rfid_epc": "3034257BF4000B4000000002",
  "accession_number": "ACC-2026-00002",
  "book_title": "Introduction to Algorithms (Reference Copy)",
  "eas_armed": true,
  "alarm_triggered": true,
  "alarm_reason": "EAS_ARMED — item is restricted (reference-only or manually flagged)",
  "footfall_count": 105,
  "cctv_timestamp_ref": "CCTV-DEV-SG-001-1762439100000-AB79ZX",
  "hardware_timestamp": "2026-11-06T14:45:00.000Z",
  "processing_status": "PENDING",
  "buffered_offline": true,
  "mock_emulator": true
}
```

---

## 4. Offline Event Queue & Synchronization

### `GET /events`
Returns paginated list of all buffered events.

**Query Parameters:**
- `limit` (int, default: 50)
- `offset` (int, default: 0)
- `status` (string, optional: `PENDING`, `SYNCED`, `FAILED`)

---

### `GET /events/pending`
Returns only events awaiting synchronization to the central backend.

---

### `POST /events/sync`
Drains pending events to the central backend API.

**Request Body:**
```json
{
  "batch_size": 50,
  "force_all": false
}
```

**Response `200 OK`:**
```json
{
  "synced": 5,
  "failed": 0,
  "remaining_pending": 0,
  "duration_ms": 230,
  "errors": []
}
```

