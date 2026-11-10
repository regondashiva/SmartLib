# SmartLib v1.6.0 — RFID Middleware Documentation

**Document ID:** `SMARTLIB-RFID-MIDDLEWARE-DOCUMENTATION-v1.6.0`  
**Service:** Python FastAPI Edge Middleware (`rfid-service/`)  
**Framework:** FastAPI 0.109+, Uvicorn, SQLite 3  
**Test Suite:** `pytest rfid-service/tests` (21/21 PASS; Exit Code 0)  
**Hardware Mode:** Software Emulation (`MOCK_HARDWARE=true`, `MOCK_RFID_MODE=true`)

---

## 1. Architectural Boundary & Edge Isolation

The SmartLib RFID Middleware Service operates as an edge IoT daemon running locally inside the library facility. It acts as an abstraction boundary between physical/emulated RFID readers and the central Express.js / PostgreSQL backend:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHYSICAL / EMULATED HARDWARE                    │
│  - Staff Station Pad    - Security Gate Pedestals   - Handheld Scanner │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ LLRP / USB / TCP Telemetry
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FASTAPI RFID MIDDLEWARE (PORT 8000)                  │
│  - Staff Station Driver (`drivers/staff_station.py`)                   │
│  - Security Gate Driver (`drivers/security_gate.py`)                   │
│  - Handheld Scanner Driver (`drivers/handheld_scanner.py`)             │
│  - Edge EAS Evaluator (< 50ms decision loop)                           │
│  - Synthetic Camera Snapshot Adapter (`drivers/camera.py`)             │
├───────────────────────────────────┬────────────────────────────────────┤
│         LOCAL DISCONNECTION       │        NORMAL ONLINE MODE          │
│                  ▼                │                 ▼                  │
│       SQLite 3 Offline Queue      │        REST API Client             │
│    `data/offline_events.db`       │   `POST /api/v1/rfid/gate/transit` │
│     (WAL Mode, FIFO Replay)       │   `POST /api/v1/rfid/inventory`    │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Core Architecture Principles:
1. **Zero Direct Cloud Database Coupling**: The middleware never connects directly to the PostgreSQL database. All state changes are negotiated through the core Express REST API.
2. **Sub-50ms Edge Transit Decisions**: Security gate pedestals verify tag EAS armed states locally without introducing campus network latency into the physical exit turnstile.
3. **Resilient Local Buffering**: In the event of a campus network failure, security gate alarms, footfall counts, and transit EPCs are written to an encrypted local SQLite WAL database (`offline_events.db`) and automatically replayed upon reconnection.
4. **Honest Emulation Flagging**: In the absence of physical Zebra or Impinj hardware, all telemetry payloads explicitly carry `mock_emulator: true` and `synthetic_cctv: true`.

---

## 2. Hardware Driver Specifications

### 2.1 Staff Station Reader (`drivers/staff_station.py`)
- **Supported Standards**: HF ISO 15693 / ISO 14443A (13.56 MHz) & UHF EPC Gen2 / ISO 18000-6C (865–868 MHz).
- **Stack Reading**: Reads 1 to 5 books placed simultaneously on the antenna pad.
- **Tag Commissioning**: Generates and writes valid EPCs and TIDs, binding them to target `BookItem` accessions.
- **EAS Bit Switching**: Automatically updates the tag security bit:
  - Checkout -> Disarm EAS bit (`easArmed: false`).
  - Check-in -> Arm EAS bit (`easArmed: true`).

### 2.2 Dual-Pedestal Security Gate (`drivers/security_gate.py`)
- **Operating Frequencies**: UHF 865–868 MHz (EU) / 902–928 MHz (US).
- **Scanning Frequency**: 20 Hz continuous read field.
- **Alarm Triggers**:
  - `easArmed === false`: Authorized checkout -> Green LED indicator, zero alarm.
  - `easArmed === true`: Unauthorized item -> High-decibel audio siren, red strobe trigger, gate alarm event emitted.
- **Footfall Tracking**: Bidirectional optical IR beam counter logs `entryCount` and `exitCount`.
- **CCTV Correlation**: Generates synthetic timestamped SVG/JPEG reference frames (`CAM-GATE-01_...`) correlated with the transit timestamp.

### 2.3 Handheld Inventory Scanner (`drivers/handheld_scanner.py`)
- **Reading Rate**: Up to 50 tags per second during rapid shelf sweeps.
- **Reconciliation Logic**:
  - `VERIFIED`: Item found on expected shelf coordinate.
  - `MISPLACED`: Item detected on an incorrect shelf location (generates re-shelving task).
  - `MISSING`: Catalogued copy missing from scan sweep.
  - `UNCATALOGED`: Tag read with no matching bibliographic record.

---

## 3. SQLite Offline Event Queue (`buffer/offline_sync.py`)

When the backend is unreachable (`is_online === false`):
1. **Atomic Insertion**: Events are stored in `data/offline_events.db` within table `offline_gate_events`:
   - `event_id`: Unique UUIDv4 (enforces idempotency).
   - `device_id`: Originating security gate or scanner ID.
   - `hardware_timestamp`: Exact hardware read time.
   - `epc_list`: JSON array of scanned tags.
   - `is_alarm`: Boolean alarm flag.
   - `sync_status`: `PENDING` -> `SYNCED`.
2. **Automatic Drain & Replay**: A background worker polls the health endpoint of the central backend. Upon restoration of connectivity, events are replayed in strict FIFO order, preserving original hardware timestamps.

---

## 4. Verification Evidence & Automated Tests

All 21 Python RFID middleware tests execute cleanly via `pytest`:

```bash
pytest rfid-service/tests
```

**Results:**
- `test_staff_station.py`: 6 passed.
- `test_security_gate.py`: 6 passed.
- `test_handheld_scanner.py`: 4 passed.
- `test_offline_buffer.py`: 5 passed.
- **Total:** **21 passed in 39.17s (Exit Code 0)**.

