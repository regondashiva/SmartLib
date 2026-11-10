# SmartLib — AISYS Requirement Traceability Matrix (RTM)

> **Traceability from Institutional Evaluation Specifications to Architectural Components**  
> **Version:** 1.0.0-RTM | **Standard:** AISYS Technical Evaluation Guidelines

---

## 1. Overview & Verification Strategy

This document establishes 100% architectural and implementation traceability from the AISYS institutional evaluation criteria to SmartLib's database models, backend services, frontend user interfaces, and hardware adapter boundaries.

Every requirement is mapped to:
- **System Layer & Domain Entity**
- **Backend API Endpoints & Business Logic**
- **Frontend Views & UI Components**
- **Hardware / Protocol Adapter Boundary**
- **Acceptance & Verification Criteria**

---

## 2. Requirement Traceability Matrix

| Req ID | AISYS Evaluation Requirement | Architectural Domain | Database Entity / Model | Backend Service / API | Frontend Component / Screen | Hardware / Protocol Boundary | Verification & Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | **Existing ILMS Non-Intrusive Integration** | Interoperability | `SystemConfiguration`, `AuditLog` | `ILMSAdapterService`, `/api/v1/adapters/ilms/*` | Settings > ILMS Integration Console | NCIP 2.0 & 3M SIP2 Protocol Adapter Boundaries | SmartLib reads patron/item statuses via standard protocols without executing destructive SQL or modifying underlying ILMS tables. |
| **REQ-02** | **Mock Staff Station RFID Integration** | Hardware & Encoding | `RFIDTag`, `BookItem`, `RFIDDevice` | `RFIDService.encodeTag()`, `POST /api/v1/rfid/encode` | RFID Suite > Staff Station Desk (`/rfid/tagging`) | Python FastAPI Middleware (`/drivers/staff_station.py`) | Desktop reader detects 1–5 tags on antenna pad simultaneously, validates EPC format, and links tag UID to accession number. |
| **REQ-03** | **Mock Handheld Reader & Shelf Inventory** | Auditing & Shelf Control | `InventorySession`, `InventoryScan`, `BookItem` | `InventoryService.reconcile()`, `POST /api/v1/inventory/sessions` | Inventory > Shelf Audit Workspace (`/inventory`) | Python FastAPI Middleware (`/drivers/handheld_scanner.py`) | Handheld reader streams bulk scans; system immediately flags verified, misplaced (wrong shelf), and missing books. |
| **REQ-04** | **Mock Security Gate & EAS Monitoring** | Anti-Theft & Security | `GateEvent`, `RFIDTag`, `BookItem`, `RFIDDevice` | `SecurityGateService.processTransit()`, `WS /api/v1/gate/stream` | Security Gate Monitor (`/gate`) | Python FastAPI Middleware (`/drivers/security_gate.py`) | Dual-pedestal gate checks EAS bit; triggers audible siren and visual alarm on un-issued item pass-through within <200ms. |
| **REQ-05** | **Smart-Card Patron Integration** | Member Services | `Member`, `RFIDTag` | `MemberService.authenticateCard()`, `GET /api/v1/members/card/:uid` | Circulation Desk > Patron Tap Modal | ISO 14443A HF Reader Adapter (`drivers/smart_card.py`) | Tapping patron ID card on reader automatically loads member profile, active loans, and eligibility without typing card number. |
| **REQ-06** | **Reference-Book Restriction Rules** | Circulation Business Logic | `BookItem.isReferenceOnly`, `Circulation` | `CirculationService.validateIssueRules()` | Circulation > Issue Desk (Warning Pill) | Business Rule Engine Guard | Checkout transaction is rejected if `isReferenceOnly = true`. EAS bit remains armed to prevent removal through gate. |
| **REQ-07** | **Blocked-Member & Policy Enforcement** | Circulation Business Logic | `Member.status`, `Member.fineBalance`, `Circulation` | `CirculationService.checkEligibility()` | Circulation > Member Standing Alert Banner | Rule Engine Policy Evaluator | Issue desk halts transaction if member has >0 overdue books, account status `BLOCKED`, or fine balance exceeding institutional cap. |
| **REQ-08** | **Configurable Fine Limits & Policies** | Financial & Governance | `Fine`, `SystemConfiguration` | `FineService.calculateFines()`, `PUT /api/v1/settings/config` | System Settings > Policies & Fines (`/settings`) | Automated Cron Worker & Admin API | Daily cron computes accumulated fines based on member category rates; supports partial payment and audited waiver workflow. |
| **REQ-09** | **RFID Tag Validation & Association** | Tagging & Processing | `RFIDTag`, `BookItem`, `AuditLog` | `TaggingService.bindTag()`, `POST /api/v1/rfid/bind` | RFID Tagging Desk (`/rfid/tagging`) | EPC Gen2 / ISO 15693 CRC Check | Validates EPC/TID checksum, checks for duplicate tag assignment across catalog, and writes immutable audit record upon binding. |
| **REQ-10** | **Inventory & Misplaced-Book Detection** | Shelf Management | `BookItem.shelfLocation`, `InventoryScan` | `InventoryService.getMisplacedItems()` | Inventory > Misplaced Item Resolution List | Handheld Batch Scanner Stream | Visual dashboard displays current physical location vs catalogued shelf coordinate with 1-click location re-assignment. |
| **REQ-11** | **Offline Security-Gate Event Recording** | Resiliency & Edge Buffering | `GateEvent` | `SecurityGateService.syncBufferedEvents()` | Security Gate > Offline Sync Status Pill | Local SQLite Buffer in Python Middleware | During network disconnect, gate writes transit events to encrypted local SQLite buffer; replays with hardware timestamps upon reconnect. |
| **REQ-12** | **Footfall & CCTV Event Reference Logging** | Physical Security Tracking | `GateEvent.footfallCount`, `GateEvent.cctvTimestampRef` | `SecurityGateService.recordTransit()` | Security Gate > Transit Incident Details Drawer | Optical Beam Sensor & DVR Token Synchronizer | Every gate transit captures instantaneous bidirectional footfall count and generated CCTV camera frame reference ID. |
| **REQ-13** | **Configurable Notification Adapters** | Communication Services | `Notification`, `SystemConfiguration` | `NotificationService.dispatch()`, `/api/v1/notifications` | Notifications Center & Patron Notice Log | SMTP (Email), Twilio/HTTP (SMS), ESC/POS (Print) | Dispatches automated due date reminders (T-2 days), overdue warnings (T+1 day), and physical checkout print receipts. |
| **REQ-14** | **20,000 Legacy Record Data Migration** | Data Engineering | `MigrationBatch`, `MigrationStagingRecord` | `MigrationService.executePipeline()`, `/api/v1/migration/*` | Data Migration Center (`/migration`) | Python Pandas & OpenPyXL Pipeline | Ingests ~20,000 legacy rows, parses ISBN/Call Numbers, flags duplicates, runs dry-run simulation, and commits with rollback token. |
| **REQ-15** | **Role-Based Access Control (RBAC)** | Security & Governance | `User`, `Role`, `Permission`, `RolePermission` | `RBACMiddleware.requirePermission()` | User & Role Administration (`/admin/users`) | JWT Claims & Route Security Guards | Restricts sensitive actions (e.g. fine waiver, system config, tag decommissioning) to authorized role tokens. |
| **REQ-16** | **Comprehensive Immutable Audit Logging** | Compliance & Accountability | `AuditLog` | `AuditService.recordLog()` | Audit Logs Explorer (`/admin/audit`) | PostgreSQL JSONB State Diff Snapshot | Captures actor ID, IP address, user agent, target entity, action, and full before/after state diff for every state mutation. |
| **REQ-17** | **Database Backup, Recovery & Offline Bundles** | DevOps & Business Continuity | Neon PITR, System Snapshots | `BackupService.triggerDump()`, `/api/v1/system/backup` | Backup & Offline Updates (`/admin/backup`) | PostgreSQL `pg_dump` & Docker Compose Bundle | Orchestrates encrypted logical backups and provides self-contained Docker Compose manifests for offline/air-gapped deployments. |

---

## 3. Mock Adapter & Hardware Boundary Architecture

To comply with the requirement that no unverified claims of production hardware or certified ILMS connectivity be made without hardware access:

```
[ Central Web Application (React + Node.js) ]
                    |
                    | (Standard REST & WebSocket Contract)
                    v
    [ SmartLib Hardware Abstraction Gateway ]
                    |
      +-------------+-------------+
      |                           |
      v                           v
[ Real Hardware Drivers ]   [ Mock Emulators (Default) ]
- Feig / Zebra HF/UHF USB   - Virtual Staff Antenna (5 tags in <50ms)
- Impinj Speedway Gate      - Virtual Gate Transit & Strobe Trigger
- Chainway C72 Handheld     - Virtual Handheld Shelf Wand Stream
- ACS ACR122U NFC Reader    - Virtual ISO 14443A Student Card Tap
```

1. **Explicit Identification**: The UI and API clearly label all hardware telemetry as `[MOCK EMULATOR]` or `[HARDWARE CONNECTED]` based on active driver configuration.
2. **Deterministic Mock Payloads**: The mock adapters generate realistic synthetic RFID telemetry:
   - EPC standard: 96-bit SGTIN-96 format (e.g., `3034257BF4000B4000000001`).
   - Gate transits simulate both authorized patron exits and unauthorized un-issued item alarms.
   - Handheld audits simulate realistic inventory scans with simulated misplaced books for demonstration.

