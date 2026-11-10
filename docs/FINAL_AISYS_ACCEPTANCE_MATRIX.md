# SmartLib — Final AISYS Acceptance Criteria Verification Matrix (`AC01`–`AC10`)

**Document Status:** Final Acceptance Verification  
**Evaluation Date:** November 9, 2026  
**System Version:** `1.5.0`  

---

## Executive Acceptance Summary

| Criterion ID | AISYS Requirement Domain | Verification Status | Primary Evidence & Test Suite | Hardware / Environment Note |
|---|---|---|---|---|
| **AC01** | Legacy Data Migration (20,000 Records) | **PASS** | `phase4c-migration.test.ts` (13/13), `phase5-final-acceptance.test.ts` (Workflow B) | Verified against Neon PostgreSQL |
| **AC02** | RFID Tag Encoding & Validation | **PASS** *(Software Adapter)* | `phase5-final-acceptance.test.ts` (Workflow A), `rfid-service/tests/` | Verified with `MOCK_RFID_MODE=true` |
| **AC03** | Complete Circulation & Fine Lifecycle | **PASS** | `phase4b-circulation.test.ts` (14/14), `phase5-final-acceptance.test.ts` (Workflow A) | Dynamic policy rules active |
| **AC04** | Patron Restrictions & RBAC Security | **PASS** | `phase4b-circulation.test.ts`, `phase4e-settings.test.ts`, `phase5-final-acceptance.test.ts` | JWT + Role Guard + Rate Limiting |
| **AC05** | Handheld RFID Shelf Inventory | **PASS** *(Software Adapter)* | `phase5-final-acceptance.test.ts` (Workflow C), `rfid-service/tests/` | Deduplicates scans; detects missing/misplaced |
| **AC06** | Dual-Pedestal Security Gate & CCTV | **PASS** *(Mock Gate + CCTV Ref)* | `phase5-final-acceptance.test.ts` (Workflow D), `rfid-service/tests/` | Logs `cctvTimestampRef`; physical DVR external |
| **AC07** | Smart Card Lookup & Staff RBAC | **PASS** | `phase5-final-acceptance.test.ts` (Section 1), `members.routes.ts` | `GET /api/v1/members/card/:uid` verified |
| **AC08** | Institutional Dashboard & Reports | **PASS** | `phase4d-reports.test.ts` (16/16), `frontend/src/tests/reports.test.tsx` (6/6) | Live SQL + CSV/PDF export + PII masking |
| **AC09** | Offline Installation & Controlled Updates | **PASS** *(With Neon DB Note)* | `phase4f-updates-recovery.test.ts` (10/10), `install-offline.ps1 -DryRun` | Local package + SQLite queue; Neon requires TLS |
| **AC10** | Backup, Restore & Data Integrity | **PASS** | `phase4f-updates-recovery.test.ts`, `phase5-final-acceptance.test.ts` (Workflow F) | SHA-256 verified snapshots + dry-run restore |

---

## Detailed Acceptance Verification Matrix (`AC01`–`AC10`)

### AC01 — Legacy Data Migration (20,000-Record Capability)
- **Requirement Description:** Import legacy library catalogs from CSV/XLSX/MARC21-JSON with column alias mapping, staging validation, duplicate ISBN/accession detection, non-destructive dry-run preview, chunked transactional commit, and safe batch rollback without corrupting pre-existing library records.
- **Implementation Module:** `backend/src/modules/migrations/`, `frontend/src/pages/DataMigration.tsx`
- **API / UI Location:** `POST /api/v1/migrations/upload`, `POST /api/v1/migrations/:id/validate`, `POST /api/v1/migrations/:id/dry-run`, `POST /api/v1/migrations/:id/commit`, `POST /api/v1/migrations/:id/rollback`, `GET /api/v1/migrations/:id/errors`
- **Test Case:** `backend/tests/phase4c-migration.test.ts` (Tests 1–13) & `backend/tests/phase5-final-acceptance.test.ts` (`Workflow B`)
- **Actual Execution Result:** Uploaded multi-row CSV/XLSX files, detected missing titles and intra-batch duplicate ISBN/accession numbers, generated dry-run projections, committed valid records into `Book` + `BookItem`, blocked rollback when an item had an active loan (`409 Conflict`), and cleanly rolled back committed records once loans were closed.
- **Status:** **PASS**
- **Remaining Limitation:** None for CSV/XLSX/MARC21-JSON batch imports; live bi-directional SIP2/NCIP sync with external legacy ILMS is out of scope.

---

### AC02 — RFID Tag Encoding, Assignment & Duplicate Prevention
- **Requirement Description:** Encode and bind HF/UHF RFID tags (`epc`, `tid`) to physical book copies (`BookItem`), enforce unique EPC and 1-to-1 copy assignment, initialize `easArmed = true`, and record audit logs.
- **Implementation Module:** `backend/src/modules/rfid/`, `rfid-service/routers/scan.py`
- **API / UI Location:** `POST /api/v1/rfid/tags`, `GET /api/v1/rfid/tags?epc=...`, `GET /api/v1/rfid/devices`
- **Test Case:** `backend/tests/phase5-final-acceptance.test.ts` (`Workflow A`)
- **Actual Execution Result:** Assigned 3 distinct EPC tags to physical copies (`201 Created`, `status: 'ACTIVE'`, `easArmed: true`), rejected duplicate EPC registration with `409 Conflict`, resolved exact book metadata via `GET /api/v1/rfid/tags?epc=...`, and logged `CREATE` entries in `AuditLog`.
- **Status:** **PASS**
- **Remaining Limitation:** Executed against the deterministic software adapter (`MOCK_RFID_MODE=true`); physical RF tag encoding hardware requires site SDK binding.

---

### AC03 — Complete Circulation & Fine Management Lifecycle
- **Requirement Description:** Support book checkout, renewal, return, automatic EAS bit disarm on checkout and re-arm on return, dynamic policy-driven loan durations and overdue fine calculation, partial/full fine payment, and administrative fine waiver with mandatory audit reason.
- **Implementation Module:** `backend/src/modules/circulation/`, `backend/src/modules/settings/`
- **API / UI Location:** `POST /api/v1/circulation/issue`, `POST /api/v1/circulation/renew`, `POST /api/v1/circulation/return`, `POST /api/v1/circulation/fines/pay`, `POST /api/v1/circulation/fines/waive`
- **Test Case:** `backend/tests/phase4b-circulation.test.ts` (14 tests) & `backend/tests/phase5-final-acceptance.test.ts` (`Workflow A`)
- **Actual Execution Result:** Verified atomic checkout (`BookItem.status -> ISSUED`, `RFIDTag.easArmed -> false`), renewal extension (`renewalCount -> 1`), overdue return (`BookItem.status -> AVAILABLE`, `RFIDTag.easArmed -> true`, `Fine` created), and full fine settlement (`Fine.status -> PAID`, `balance -> 0`).
- **Status:** **PASS**
- **Remaining Limitation:** None.

---

### AC04 — Patron Borrowing Restrictions & Security Enforcement
- **Requirement Description:** Block circulation for suspended/blocked patrons, enforce reference-only book restrictions, enforce maximum active loans per member category, enforce fine threshold blocks, and protect all endpoints with JWT authentication, RBAC role guards, and login rate limiting.
- **Implementation Module:** `backend/src/modules/circulation/circulation.service.ts`, `backend/src/middleware/auth.ts`, `backend/src/middleware/rbac.ts`, `backend/src/middleware/rateLimit.ts`
- **API / UI Location:** All `/api/v1/*` protected endpoints
- **Test Case:** `backend/tests/phase4b-circulation.test.ts` (`TC-02`, `TC-03`, `TC-04`, `TC-05`, `TC-07`, `TC-08`) & `backend/tests/phase5-final-acceptance.test.ts` (`Section 1`)
- **Actual Execution Result:** Reference-only items, blocked patrons, exceeded borrow limits, and exceeded renewal counts are rejected with `400 Bad Request`. Unauthenticated requests return `401`, unauthorized role mutations return `403`, and repeated login bursts under rate-limit enforcement return `429 Too Many Requests`.
- **Status:** **PASS**
- **Remaining Limitation:** None.

---

### AC05 — Handheld RFID Shelf Inventory & Reconciliation
- **Requirement Description:** Conduct shelf-level RFID inventory sessions, deduplicate repeated tag reads in the same sweep, reconcile scanned EPCs against catalogued `BookItem.shelfLocation`, and classify items as `VERIFIED`, `MISPLACED`, `MISSING`, or `UNCATALOGED`.
- **Implementation Module:** `backend/src/modules/rfid/rfid.service.ts`, `rfid-service/routers/scan.py`
- **API / UI Location:** `POST /api/v1/rfid/inventory-sessions`, `GET /api/v1/reports/inventory`
- **Test Case:** `backend/tests/phase5-final-acceptance.test.ts` (`Workflow C`)
- **Actual Execution Result:** Submitted 4 raw EPC reads (including 1 duplicate EPC, 1 copy belonging to another shelf, and 1 uncatalogued EPC) while omitting 1 expected shelf copy. The reconciliation engine persisted the `InventorySession` and `InventoryScan` records with `rawScanCount: 4`, `uniqueScannedCount: 3`, `duplicateScanCount: 1`, `totalVerified: 1`, `totalMisplaced: 1`, `totalMissing: 1`, and `totalUncataloged: 1`.
- **Status:** **PASS**
- **Remaining Limitation:** Tested via API/emulator sweep payload; physical handheld UHF reader SDK integration is required for live floor sweeps.

---

### AC06 — Security Gate EAS Validation & CCTV Timestamp Correlation
- **Requirement Description:** Inspect RFID tag `easArmed` state during security gate transit, allow silent passage when `easArmed = false`, trigger an alarm event when `easArmed = true`, record bidirectional footfall count, attach a CCTV timestamp correlation reference (`cctvTimestampRef`), and surface alerts in reports and audit logs.
- **Implementation Module:** `backend/src/modules/rfid/rfid.service.ts`, `rfid-service/routers/scan.py`, `frontend/src/pages/SecurityGateMonitor.tsx`
- **API / UI Location:** `POST /api/v1/rfid/gate-events`, `GET /api/v1/reports/security-gates`
- **Test Case:** `backend/tests/phase5-final-acceptance.test.ts` (`Workflow D`) & `rfid-service/tests/test_rfid_service.py`
- **Actual Execution Result:** Armed tag transit created a `GateEvent` with `alarmTriggered: true`, `easArmed: true`, `cctvTimestampRef: "CAM-GATE-01_..."`, `hardwareMode: "MOCK_EMULATOR"`, and an `AuditLog` entry. Disarmed tag transit recorded `alarmTriggered: false`.
- **Status:** **PASS**
- **Remaining Limitation:** Uses mock gate telemetry and timestamp correlation strings; physical gate relay alarms and external NVR video streams are hardware-dependent.

---

### AC07 — Smart Card Patron Lookup & Role-Based Access Control
- **Requirement Description:** Resolve patron identity, department, fine balance, and borrowing eligibility via contactless Smart Card UID (`GET /api/v1/members/card/:uid`) and enforce strict separation of privileges across `ADMIN`, `LIBRARIAN`, and `RFID_OPERATOR`.
- **Implementation Module:** `backend/src/modules/members/`, `backend/src/middleware/rbac.ts`
- **API / UI Location:** `GET /api/v1/members/card/:uid`, `frontend/src/components/auth/ProtectedRoute.tsx`
- **Test Case:** `backend/tests/phase5-final-acceptance.test.ts` (`Section 1`)
- **Actual Execution Result:** Smart card lookup returned exact patron profile (`200 OK`) for valid UIDs and `404 Not Found` for unregistered cards; RBAC matrix verified across all protected routes.
- **Status:** **PASS**
- **Remaining Limitation:** None.

---

### AC08 — Real-Time Institutional Dashboard & Exportable Reports
- **Requirement Description:** Provide live database-backed KPIs and 9 institutional reports (Circulation, Overdue, Inventory, Members, Fines, RFID Devices, Security Gates, Operators, Migrations) with date filtering, CSV/PDF export, and role-based PII masking for member contact fields.
- **Implementation Module:** `backend/src/modules/reports/`, `frontend/src/pages/ReportsAnalytics.tsx`
- **API / UI Location:** `GET /api/v1/reports/dashboard`, `GET /api/v1/reports/:type`, `GET /api/v1/reports/export/csv`, `GET /api/v1/reports/export/pdf`
- **Test Case:** `backend/tests/phase4d-reports.test.ts` (16/16) & `frontend/src/tests/reports.test.tsx` (6/6)
- **Actual Execution Result:** All 12 endpoints return live PostgreSQL aggregates; `RFID_OPERATOR` responses redact member email/phone (`piiMasked: true`); CSV and PDF binary streams verified.
- **Status:** **PASS**
- **Remaining Limitation:** None.

---

### AC09 — Offline Installation, Version Validation & Controlled Updates
- **Requirement Description:** Provide an offline installation package (`deploy/offline-package/`), validate version manifests, artifact SHA-256 digests, and runtime prerequisites, enforce pre-update backups, execute controlled updates, automatically roll back failed updates, and preserve the SQLite RFID offline event queue across restarts.
- **Implementation Module:** `backend/src/modules/system/`, `deploy/offline-package/`, `frontend/src/pages/backup/BackupUpdates.tsx`
- **API / UI Location:** `POST /api/v1/system/packages/validate`, `POST /api/v1/system/updates/execute`, `POST /api/v1/system/rollback`
- **Test Case:** `backend/tests/phase4f-updates-recovery.test.ts` (10/10), `deploy/offline-package/scripts/install-offline.ps1 -DryRun`
- **Actual Execution Result:** Validated offline manifest, blocked tampered checksums/path traversal/unsupported runtimes, executed 11-step update lifecycle, verified automatic rollback to last known-good version on simulated health-check failure, and verified SQLite `event_buffer.db` queue compatibility.
- **Status:** **PASS** *(With Documented Cloud DB Requirement)*
- **Remaining Limitation:** While application installation and RFID event buffering operate offline, the Express backend requires network connectivity to Neon PostgreSQL unless an on-premise PostgreSQL instance is configured.

---

### AC10 — Database Backup, Checksum Verification & Safe Restore
- **Requirement Description:** Create logical database backups with SHA-256 integrity digests, detect tampered backup files on disk, support isolated dry-run restore verification (`DRY_RUN_VERIFY`), require explicit administrative confirmation before `FULL_RESTORE`, and log all recovery operations in `AuditLog`.
- **Implementation Module:** `backend/src/modules/system/system.service.ts`
- **API / UI Location:** `POST /api/v1/system/backups`, `POST /api/v1/system/backups/verify`, `GET /api/v1/system/history`
- **Test Case:** `backend/tests/phase4f-updates-recovery.test.ts` & `backend/tests/phase5-final-acceptance.test.ts` (`Workflow F`)
- **Actual Execution Result:** Created verified snapshot in `data/backups/`, verified SHA-256 digest match, detected disk byte tampering (`400 Bad Request`), verified dry-run restore record reconciliation, and enforced confirmation gate on `FULL_RESTORE`.
- **Status:** **PASS**
- **Remaining Limitation:** None.

---

## Phase 5A Gap-Closure Verification Matrix (`SOP 2.1`–`4.5`)

| SOP Section | Requirement Domain | Implementation Module & UI Route | Test Suite & Execution Result | Status |
|---|---|---|---|---|
| **SOP 2.1** | Acquisition Management (Suppliers, Requests, POs, Receiving → Catalog) | `backend/src/modules/acquisitions/`, `/acquisitions` | `phase5a-gap-closure.test.ts` (Test 1), `phase5a.test.tsx` (Test 3) | **PASS** |
| **SOP 2.2** | Bibliographic Cataloguing & Copy Management | `backend/src/modules/books/`, `/cataloguing` | `phase4a-cataloguing.test.ts` (12/12) | **PASS** |
| **SOP 2.3** | Serials Management (ISSN Validation, Issues, Missing/Renewal Tracking) | `backend/src/modules/serials/`, `/serials` | `phase5a-gap-closure.test.ts` (Test 2), `phase5a.test.tsx` (Test 3) | **PASS** |
| **SOP 2.4** | Circulation & Dedicated Due-Date Enquiry | `GET /api/v1/circulation/due-date-enquiry`, `/circulation` | `phase5a-gap-closure.test.ts` (Test 3), `phase4b-circulation.test.ts` (14/14) | **PASS** |
| **SOP 2.5** | Barcode & Spine-Label Management (Code-128B SVG & Print-Ready PDF) | `backend/src/modules/labels/`, `/labels` | `phase5a-gap-closure.test.ts` (Test 3), `phase5a.test.tsx` (Test 2) | **PASS** |
| **SOP 3.1–3.4** | Public OPAC, Ranked Full-Text Search, Net Cataloguing & Virtual Bookshelf | `backend/src/modules/opac/`, `/opac`, `/bookshelf` | `phase5a-gap-closure.test.ts` (Test 4), `phase5a.test.tsx` (Test 1) | **PASS** |
| **SOP 4.1–4.5** | 9 Device-Neutral Adapters, NCIP 2.0 Boundary, 3M SIP2 Parser/Serializer & Audited Tag Reassignment | `backend/src/modules/adapters/`, `PUT /api/v1/rfid/tags/:id/reassign` | `phase5a-gap-closure.test.ts` (Test 5) | **PASS** *(Adapter Boundary)* |
| **Phase 5B-2** | Handheld Visible/Audible Confirmation, Gate Offline Bit Read, Mock CCTV SVG Attachment & Footfall | `backend/src/modules/rfid/rfid.service.ts`, `rfid-service/drivers/` | `phase5b-acceptance.test.ts` (Test 1), `pytest` (21/21) | **PASS** *(Software Adapter)* |
| **Phase 5B-3** | Provider-Neutral Email/SMS/Print Notification Queue (`PENDING`/`SENT`/`FAILED`/`RETRY`) & Preferences | `backend/src/modules/notifications/` | `phase5b-acceptance.test.ts` (Test 2) | **PASS** *(Mock Providers)* |
| **Phase 5B-4** | NCIP 2.0 & 3M SIP2 Live Circulation, Duplicate/Invalid Request Handling & Protocol Audit Trail | `backend/src/modules/adapters/adapters.service.ts` | `phase5b-acceptance.test.ts` (Test 3) | **PASS** *(Adapter Boundary)* |
| **Phase 5B-5** | Real (Non-Dry-Run) Offline Package Installation into Isolated Directory + SHA-256 Receipt | `deploy/offline-package/scripts/install-offline.ps1` | `phase5b-acceptance.test.ts` (Test 4) | **PASS** *(With Host DB Note)* |
| **Phase 5B-6/7** | Real PostgreSQL SQL Dump, Simulated Failed Migration, Isolated Schema Restore & CycloneDX 1.5 SBOM | `backend/src/modules/system/postgres-backup-restore.ts` | `phase5b-acceptance.test.ts` (Test 5) | **PASS** |



