# SmartLib — RFID Edge Middleware Service

> **Edge Hardware Gateway & Mock RFID Emulators for SmartLib**  
> **Technology:** Python 3.12 | FastAPI | Pydantic v2 | aiosqlite | HTTPx | Structlog | Pytest  
> **Version:** 1.0.0-phase2b | **Port:** 8000

---

## 1. Overview & Architectural Role

SmartLib RFID Middleware is a standalone edge IoT gateway service that decouples physical/simulated library RFID devices from the central Express.js / Neon PostgreSQL application server.

```
+-----------------------------------------------------------------------------------+
|                        SMARTLIB RFID EDGE ARCHITECTURE                            |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [Staff Station]        [Handheld Wand]       [Security Gate]   [Smart Card Tap]  |
|  (HF/UHF Desk Pad)     (Bulk Shelf Reader)   (Dual-Pedestal)    (ISO 14443A HF)   |
|         |                      |                     |                 |          |
|         +----------------------+---------------------+-----------------+          |
|                                |                                                  |
|                                v                                                  |
|                +-------------------------------+                                  |
|                |  SmartLib Python FastAPI Edge |                                  |
|                |         (Port 8000)           |                                  |
|                +---------------+---------------+                                  |
|                                |                                                  |
|               +----------------+----------------+                                 |
|               | (Online: REST)                  | (Offline Failover)              |
|               v                                 v                                 |
|     +--------------------+            +--------------------+                      |
|     | Express.js Backend |            | Local SQLite Buffer|                      |
|     |  API (Port 5000)   |            | (offline_events.db)|                      |
|     +--------------------+            +--------------------+                      |
|               |                                 | (Auto-Replay on Reconnect)      |
|               v                                 +---------------------------------+
|     +--------------------+                                                        |
|     | Neon PostgreSQL DB |                                                        |
|     +--------------------+                                                        |
+-----------------------------------------------------------------------------------+
```

### Key Principles:
- **No Direct Neon DB Access**: The edge middleware communicates **strictly via REST API calls** with the central Express backend. It never talks directly to Neon PostgreSQL.
- **Hardware Isolation**: Web browsers and library business logic never communicate with raw serial or LLRP antenna sockets.
- **Offline Resiliency**: When network connectivity to the central server drops, security gate transits are safely buffered in local SQLite with exact hardware timestamps. When the network is restored, events are drained automatically without duplicates.
- **Clear Mock Attribution**: All emulated telemetry is explicitly tagged with `mock_emulator: true` to prevent mistaking simulation for physical hardware certification.

---

## 2. Directory Structure

```
rfid-service/
├── .env.example              # Environment variables template
├── requirements.txt          # Python dependencies
├── config.py                 # Pydantic BaseSettings configuration
├── logger.py                 # Leveled structured JSON/console logging
├── schemas.py                # Pydantic v2 validation models
├── backend_client.py         # HTTPX client with retry, JWT auth & probe
├── main.py                   # FastAPI application & lifecycle handlers
├── buffer/
│   ├── __init__.py
│   └── offline_sync.py       # SQLite event queue & sync worker
├── drivers/
│   ├── __init__.py
│   ├── mock_data.py          # Deterministic 96-bit SGTIN-96 catalog & EPC generator
│   ├── staff_station.py      # Desk antenna pad driver (1–5 tags, duplicate check)
│   ├── handheld_scanner.py   # Bulk shelf inventory wand driver
│   └── security_gate.py      # Dual-pedestal EAS alarm & footfall driver
├── routers/
│   ├── __init__.py
│   ├── devices.py            # GET /devices, GET /devices/status
│   ├── scan.py               # POST /devices/*/scan and /event
│   └── events.py             # GET /events, /pending, POST /events/sync
└── tests/
    ├── __init__.py
    ├── conftest.py           # Shared test fixtures & temp SQLite DB
    ├── test_drivers.py       # Driver unit tests
    ├── test_buffer.py        # Buffer queue and persistence tests
    └── test_api.py           # REST API integration tests
```

---

## 3. Configuration (`.env`)

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `SERVICE_NAME` | `smartlib-rfid-middleware` | Identifier in logs and health check |
| `SERVICE_PORT` | `8000` | Port for FastAPI service |
| `LOG_LEVEL` | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`) |
| `MOCK_HARDWARE` | `true` | `true` enables software emulators |
| `BACKEND_API_URL` | `http://localhost:5000/api/v1` | Express backend base URL |
| `BACKEND_LOGIN_EMAIL` | `admin@smartlib.ac.in` | Service account for JWT token |
| `BACKEND_LOGIN_PASSWORD` | `Admin@SmartLib2026!` | Service account password |
| `SQLITE_BUFFER_PATH` | `./data/offline_events.db` | Local SQLite database file |
| `SYNC_INTERVAL_SECONDS` | `30` | Automatic offline buffer drain interval |
| `STAFF_STATION_DEVICE_ID`| `DEV-SS-001` | Desk station reader ID |
| `HANDHELD_DEVICE_ID` | `DEV-HH-001` | Mobile wand reader ID |
| `SECURITY_GATE_DEVICE_ID`| `DEV-SG-001` | Dual-pedestal exit gate ID |

---

## 4. How to Run Locally

### 1. Install Dependencies
```bash
cd rfid-service
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Start Development Server
```bash
uvicorn main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Redoc: `http://localhost:8000/redoc`
- Health check: `http://localhost:8000/health`

### 4. Run Test Suite
```bash
pytest tests -v
```

---

## 5. Mock Simulation Scenarios

### Scenario A: Staff Station Desk Scan (Simultaneous Tags)
```bash
curl -X POST http://localhost:8000/devices/staff-station/scan \
  -H "Content-Type: application/json" \
  -d '{"tag_count": 3}'
```

### Scenario B: Handheld Shelf Inventory Sweep
```bash
curl -X POST http://localhost:8000/devices/handheld/scan \
  -H "Content-Type: application/json" \
  -d '{
    "target_shelf": "STACK-A/AISLE-01/SHELF-03",
    "tag_count": 10
  }'
```

### Scenario C: Authorized Patron Exit (EAS Disarmed)
```bash
curl -X POST http://localhost:8000/devices/security-gate/event \
  -H "Content-Type: application/json" \
  -d '{"rfid_epc": "3034257BF4000B4000000001"}'
```
*Result: `alarm_triggered: false`, green indicator transit logged.*

### Scenario D: Unauthorized Removal (Reference Copy / EAS Armed)
```bash
curl -X POST http://localhost:8000/devices/security-gate/event \
  -H "Content-Type: application/json" \
  -d '{"rfid_epc": "3034257BF4000B4000000002"}'
```
*Result: `alarm_triggered: true`, optical strobe and siren fired, CCTV frame reference captured.*

### Scenario E: Offline Event Replay
1. When backend is down, gate events automatically enter `data/offline_events.db`.
2. Inspect pending events: `GET http://localhost:8000/events/pending`
3. Trigger manual synchronization once backend is restored: `POST http://localhost:8000/events/sync`

