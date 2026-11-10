# SmartLib v1.6.0 — Complete System Module Documentation

**Document ID:** `FINAL-SYSTEM-MODULE-DOCUMENTATION-v1.6.0`  
**Audit & Closure Date:** November 10, 2026  
**Application:** SmartLib RFID-Enabled Integrated Library Management System  

---

## 1. Module Inventory Overview

SmartLib v1.6.0 incorporates **22 unified application modules** spanning core library management, physical RFID automation, patron services, system governance, and public discovery. Every module is integrated with the Express REST API and protected by Role-Based Access Control (RBAC).

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SMARTLIB v1.6.0 ARCHITECTURE                          │
├──────────────────────────┬──────────────────────────┬───────────────────────────┤
│    PATRON & DISCOVERY    │   CIRCULATION & RFID     │   ACQUISITIONS & DATA     │
│  - Public OPAC (21)      │  - Circulation Desk (8)  │  - Acquisition Mgmt (5)   │
│  - Virtual Bookshelf (22)│  - RFID Tagging (9)      │  - Serials Mgmt (6)       │
│  - Members Mgmt (7)      │  - RFID Devices (10)     │  - Cataloguing (4)        │
│  - Book Catalog (3)      │  - Handheld Sweeps (11)  │  - Barcode & Labels (16)  │
│                          │  - Security Gate (12)    │  - Data Migration (13)    │
├──────────────────────────┴──────────────────────────┴───────────────────────────┤
│                         ADMINISTRATION & GOVERNANCE                             │
│  - Landing & Auth (1, 2) │  - System Settings (17)  │  - Audit Trail (19)       │
│  - Dashboard (3)         │  - Users & Roles (18)    │  - Backup & Health (20)   │
│  - Reports & BI (14)     │  - Notifications (15)    │                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Module Specifications (Modules 1–22)

### Module 1: Landing Page & Authentication Gateway
- **Route:** `/` (Unauthenticated)
- **Purpose:** Welcoming institutional portal providing public access pathways and secure staff login entry points.
- **Main Functionality:** Institutional branding, quick feature summary, redirect to Public OPAC for students/public, and single-click access to Staff Login.
- **User Roles:** Public, Student, Faculty, Staff, Librarian, Admin.
- **Important Workflows:** Public catalog discovery redirection; staff credential gateway routing.
- **Backend/API Integration:** Client-side routing with route guards.
- **Verification Evidence:** Verified responsive split-card layout in `src/tests/phase5a.test.tsx` (Test 1 PASS).

---

### Module 2: Staff Authentication & Session Security
- **Route:** `/login`
- **Purpose:** Secure access gateway for library personnel and administrative staff.
- **Main Functionality:** JWT authentication, bcrypt password validation, "Remember Me" credential caching, role-based destination redirect, and quick-fill demo buttons for evaluation.
- **User Roles:** `ADMIN`, `LIBRARIAN`, `RFID_OPERATOR`, `STUDENT`.
- **Important Workflows:** User submits institutional credentials -> backend issues HMAC-SHA256 JWT access token -> user profile and permissions stored in React auth context.
- **Backend/API Integration:** `POST /api/v1/auth/login`, `GET /api/v1/auth/me`.
- **Verification Evidence:** `backend/tests/auth.test.ts` (6/6 PASS; Exit Code 0).

---

### Module 3: Institutional Executive Dashboard
- **Route:** `/dashboard` (or `/` authenticated)
- **Purpose:** Central operational overview displaying real-time metrics, circulation velocity, and device health.
- **Main Functionality:** 8 real-time KPI stat cards (Total Titles, Total Physical Copies, Active Members, Books on Loan, Overdue Fines, Gate Alarms, RFID Devices Online, System Health), weekly circulation charts, category distribution, and quick action shortcuts.
- **User Roles:** `ADMIN`, `LIBRARIAN`, `RFID_OPERATOR`.
- **Important Workflows:** Dashboard auto-loads cached metrics and polls system status every 30 seconds.
- **Backend/API Integration:** `GET /api/v1/dashboard/metrics`, `GET /api/v1/circulation/weekly`, `GET /api/v1/health`.
- **Verification Evidence:** Verified responsive layout in `phase5a.test.tsx` and live production build.

---

### Module 4: Book Catalog & Copy Breakdown
- **Route:** `/books`, `/books/:id`
- **Purpose:** High-performance bibliographic exploration, physical copy availability breakdown, and shelf location lookup.
- **Main Functionality:** Multi-field catalog search (title, author, ISBN, category), availability status filtering (`ALL`, `AVAILABLE`, `CHECKED_OUT`, `REFERENCE`), physical copy drawer with accession list, condition status, and shelf location coordinates.
- **User Roles:** `ADMIN`, `LIBRARIAN`, `RFID_OPERATOR`.
- **Important Workflows:** Librarian searches catalog -> expands monograph -> views all bound physical copies, current circulation states, and RFID EPC bindings.
- **Backend/API Integration:** `GET /api/v1/books`, `GET /api/v1/books/:id`.
- **Verification Evidence:** `backend/tests/phase4a-cataloguing.test.ts` (9/9 PASS; Exit Code 0) & live screenshot verification.

---

### Module 5: Cataloguing & Accessioning
- **Route:** `/cataloguing`
- **Purpose:** Authoritative bibliographic metadata creation and physical copy accession provisioning.
- **Main Functionality:** MARC21/Dublin Core standard fields, ISO 2108 mod-10 valid ISBN validation, sequential accession number provisioning (`ACC-YYYY-XXXXX`), shelf location coordinates (Floor, Rack, Shelf), and non-circulating reference flags.
- **User Roles:** `ADMIN`, `LIBRARIAN`.
- **Important Workflows:** Input bibliographic details -> choose copy quantity -> system atomically provisions physical `BookItem` records with sequential unique accession numbers.
- **Backend/API Integration:** `POST /api/v1/books`, `GET /api/v1/settings/accession-format`.
- **Verification Evidence:** `backend/tests/phase4a-cataloguing.test.ts` (9/9 PASS; Exit Code 0).

---

### Module 6: Acquisition Management
- **Route:** `/acquisitions` (Tab 1)
- **Purpose:** End-to-end procurement lifecycle management for institutional library suppliers and purchase orders.
- **Main Functionality:** Supplier directory with contact details, Purchase Order (PO) creation, order status tracking (`PENDING`, `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`), multi-item receiving inspection, and atomic one-click conversion into catalogued books.
- **User Roles:** `ADMIN`, `LIBRARIAN`.
- **Important Workflows:** Create PO for supplier -> mark copies received upon delivery -> click "Convert to Catalog" -> books and physical accession items created without duplicate entry.
- **Backend/API Integration:** `GET/POST /api/v1/acquisitions/orders`, `POST /api/v1/acquisitions/orders/:id/receive`.
- **Verification Evidence:** `backend/tests/phase5a-gap-closure.test.ts` (Test 1 PASS; Exit Code 0) & live screenshot verification.

---

### Module 7: Serials & Periodicals Management
- **Route:** `/acquisitions` (Tab 2) or `/serials`
- **Purpose:** Continuing resource tracking for journals, magazines, and recurring periodicals.
- **Main Functionality:** Serial subscription registry, regex-enforced ISSN validation (`XXXX-XXXX`), publication frequency schedules (Daily, Weekly, Monthly, Quarterly, Annual), issue check-in modal, missing issue tracking, and renewal expiration alerts.
- **User Roles:** `ADMIN`, `LIBRARIAN`.
- **Important Workflows:** Register journal subscription -> receive recurring issue -> log Volume and Issue number -> update next expected arrival date.
- **Backend/API Integration:** `GET/POST /api/v1/serials`, `POST /api/v1/serials/:id/issues`.
- **Verification Evidence:** `backend/tests/phase5a-gap-closure.test.ts` (Test 2 PASS; Exit Code 0) & live screenshot verification.

---

### Module 8: Patron & Members Management
- **Route:** `/members`, `/members/:id`
- **Purpose:** Institutional patron account administration, borrowing entitlement enforcement, and smart-card binding.
- **Main Functionality:** Member directory, category allocation (`STUDENT`, `FACULTY`, `STAFF`, `RESEARCH_SCHOLAR`), smart-card contactless UID binding, patron blocking/suspension, active loan tracking, and account expiration dates.
- **User Roles:** `ADMIN`, `LIBRARIAN`.
- **Important Workflows:** Staff registers student -> scans ISO 14443A card UID -> patron borrowing limits enforced according to institutional category policy.
- **Backend/API Integration:** `GET/POST /api/v1/members`, `GET /api/v1/members/card/:uid`, `PATCH /api/v1/members/:id`.
- **Verification Evidence:** `backend/tests/phase5-final-acceptance.test.ts` (Section 1 PASS; Exit Code 0) & live screenshot verification.

---

### Module 9: Circulation Desk
- **Route:** `/circulation`
- **Purpose:** Front-desk borrowing lifecycle management including book issue, return, renewal, and overdue fine collection.
- **Main Functionality:** Smart card patron scan, accession barcode scan, borrow validation (blocks non-circulating reference items and saturated limits), issue book (disarms tag EAS bit), return book (re-arms tag EAS bit), renew loan (max 2 renewals), overdue fine calculation, partial/full fine payments, and audited fine waivers.
- **User Roles:** `ADMIN`, `LIBRARIAN`.
- **Important Workflows:** Patron card scanned -> Book accession scanned -> Issue confirmed -> Due date receipt generated -> EAS security bit disarmed.
- **Backend/API Integration:** `POST /api/v1/circulation/issue`, `POST /api/v1/circulation/return`, `POST /api/v1/circulation/renew`, `POST /api/v1/circulation/fines/pay`.
- **Verification Evidence:** `backend/tests/phase4b-circulation.test.ts` (14/14 PASS; Exit Code 0) & `tests/businessRules.test.ts` (6/6 PASS).

---

### Module 10: RFID Tagging & Encoding
- **Route:** `/rfid/tagging`
- **Purpose:** Staff station tag commissioning, EPC/TID encoding, and book binding.
- **Main Functionality:** Handheld/desktop encoder communication, EPC (Electronic Product Code) and TID generation, duplicate tag validation, physical copy binding, EAS security bit toggle, and audited tag reassignment.
- **User Roles:** `ADMIN`, `LIBRARIAN`, `RFID_OPERATOR`.
- **Important Workflows:** Place book on staff station -> scan accession number -> write EPC -> bind to `BookItem` -> arm EAS bit.
- **Backend/API Integration:** `POST /api/v1/rfid/tags/encode`, `PUT /api/v1/rfid/tags/:id/reassign`.
- **Verification Evidence:** `backend/tests/phase5a-gap-closure.test.ts` (Test 5 PASS; Exit Code 0) & `pytest rfid-service/tests` (21/21 PASS).

---

### Module 11: RFID Device Management
- **Route:** `/rfid/devices`
- **Purpose:** Institutional hardware device directory, live telemetry, and peripheral parameter configuration.
- **Main Functionality:** Device registry (Staff Stations, Security Gates, Handheld Scanners), IP/port configuration, connection status monitor (Online/Offline/Degraded), antenna power settings (dBm), and read rate telemetry.
- **User Roles:** `ADMIN`, `RFID_OPERATOR`.
- **Important Workflows:** Register device -> configure antenna power -> receive heartbeat ping -> monitor hardware online status.
- **Backend/API Integration:** `GET /api/v1/rfid/devices`, `PATCH /api/v1/rfid/devices/:id`.
- **Verification Evidence:** `backend/tests/phase5b-acceptance.test.ts` & `rfid-service/tests` (21/21 PASS; Exit Code 0).

---

### Module 12: Handheld RFID Inventory
- **Route:** `/inventory`
- **Purpose:** High-speed physical inventory reconciliation using bulk RFID handheld sweeps.
- **Main Functionality:** Handheld batch upload, real-time de-duplication, shelf classification (`VERIFIED`, `MISPLACED`, `MISSING`, `UNCATALOGED`), accession resolution, and audible feedback tone generation.
- **User Roles:** `ADMIN`, `LIBRARIAN`, `RFID_OPERATOR`.
- **Important Workflows:** Operator performs shelf sweep -> transmits EPC array -> system matches against expected shelf catalogue -> flags misplaced/missing items with shelf coordinates.
- **Backend/API Integration:** `POST /api/v1/rfid/inventory/sweep`.
- **Verification Evidence:** `backend/tests/phase5b-acceptance.test.ts` (Test 1.1 PASS; Exit Code 0).

---

### Module 13: Security Gate & EAS Monitoring
- **Route:** `/security-gate`
- **Purpose:** Real-time perimeter loss prevention, unauthorized item transit alarming, footfall analytics, and video correlation.
- **Main Functionality:** Gate transit listener, EAS armed security bit evaluation, audible/visual unauthorized transit alarms, entry/exit footfall counters, offline event buffering in SQLite, and synthetic CCTV reference frame correlation (`640x360`).
- **User Roles:** `ADMIN`, `LIBRARIAN`, `RFID_OPERATOR`.
- **Important Workflows:** Patron passes gate -> tags scanned -> armed EAS triggers alarm -> gate event logged with timestamp, footfall count, and synthetic snapshot -> notification dispatched.
- **Backend/API Integration:** `POST /api/v1/rfid/gate/transit`, `GET /api/v1/rfid/gate/events`.
- **Verification Evidence:** `backend/tests/phase5b-acceptance.test.ts` (Tests 1.2–1.4 PASS) & `rfid-service/tests` (21/21 PASS).

---

### Module 14: Data Migration Console
- **Route:** `/migration`
- **Purpose:** High-capacity institutional migration engine capable of ingesting 20,000 legacy records.
- **Main Functionality:** Multi-format file ingestion (CSV, XLSX, MARC21-JSON), dynamic field mapping, schema validation, dry-run projection report, transactional database commit, and pre-migration backup rollback.
- **User Roles:** `ADMIN`.
- **Important Workflows:** Upload legacy catalog file -> map columns to SmartLib schema -> execute dry run (inspect errors/warnings) -> commit transactionally -> rollback if validation fails.
- **Backend/API Integration:** `POST /api/v1/migration/upload`, `POST /api/v1/migration/validate`, `POST /api/v1/migration/commit`, `POST /api/v1/migration/rollback`.
- **Verification Evidence:** `backend/tests/phase4c-migration.test.ts` (13/13 PASS; Exit Code 0).

---

### Module 15: Reports & Business Intelligence
- **Route:** `/reports`
- **Purpose:** Comprehensive institutional reporting, circulation analytics, inventory reconciliation, and compliance exports.
- **Main Functionality:** 10 standardized institutional reports (Collection Valuation, Overdue Loans, Fine Collection, Gate Alarms, Missing Inventory, Patron Borrowing, etc.), date range and category filters, formula-injection neutralized CSV export, and styled PDF reports.
- **User Roles:** `ADMIN`, `LIBRARIAN`.
- **Important Workflows:** Select report type -> apply date/category filters -> generate tabular preview -> export print-ready PDF or neutralized CSV.
- **Backend/API Integration:** `GET /api/v1/reports/:type`, `GET /api/v1/reports/export`.
- **Verification Evidence:** `backend/tests/phase4d-reports.test.ts` (13/13 PASS; Exit Code 0) & `reports.test.tsx` (PASS).

---

### Module 16: Notification Center
- **Route:** `/notifications`
- **Purpose:** Multi-channel notification dispatch and queue management for library communications.
- **Main Functionality:** Queue state machine (`PENDING` -> `SENT` or `FAILED` -> `RETRY` -> `SENT`), channel routing (Email, SMS, Print Slips), template variable rendering (due dates, fine amounts, patron names), patron opt-in/opt-out channel preferences, and delivery audit logs.
- **User Roles:** `ADMIN`, `LIBRARIAN`.
- **Important Workflows:** Event occurs (e.g. book checkout, overdue notice) -> message queued -> worker processes queue -> updates status and records timestamped delivery log.
- **Backend/API Integration:** `GET /api/v1/notifications`, `POST /api/v1/notifications/process`.
- **Verification Evidence:** `backend/tests/phase5b-acceptance.test.ts` (Test 2 PASS; Exit Code 0).

---

### Module 17: Barcode & Spine-Label Printing
- **Route:** `/labels`
- **Purpose:** Physical copy identification label generation and thermal/sheet printing.
- **Main Functionality:** Sequential and copy-specific Code-128B barcode generation, real-time label preview (Library Name, Call Number, Accession Barcode, Title), and print-ready multi-label PDF sheets across configurable sheet dimensions (A4 2x5, 3x8).
- **User Roles:** `ADMIN`, `LIBRARIAN`.
- **Important Workflows:** Select catalog item or accession range -> choose layout template -> preview labels -> click "Print Sheet" to emit PDF.
- **Backend/API Integration:** `POST /api/v1/labels/generate`, `GET /api/v1/labels/preview`.
- **Verification Evidence:** `backend/tests/phase5a-gap-closure.test.ts` (Test 3 PASS; Exit Code 0) & `phase5a.test.tsx` (PASS).

---

### Module 18: System Settings & Policy Configuration
- **Route:** `/settings`
- **Purpose:** Centralized institutional policy management, circulation caps, and business rules.
- **Main Functionality:** 6 configuration tabs: General Institutional Info, Circulation Policies (Loan duration, Max books by category, Max renewals), Fines & Fees (Daily overdue rate, Grace period, Waiver threshold), Accession Formats, RFID Device Defaults, and Notification Templates.
- **User Roles:** `ADMIN`.
- **Important Workflows:** Admin modifies daily fine rate or patron borrowing cap -> settings saved atomically -> all circulation services dynamically enforce updated policy.
- **Backend/API Integration:** `GET /api/v1/settings`, `PATCH /api/v1/settings`.
- **Verification Evidence:** `backend/tests/phase4e-settings.test.ts` (9/9 PASS; Exit Code 0).

---

### Module 19: User & Role Management
- **Route:** `/users`, `/roles`
- **Purpose:** Staff directory administration, credential provisioning, and RBAC permission assignment.
- **Main Functionality:** Staff user CRUD, role assignment (`ADMIN`, `LIBRARIAN`, `RFID_OPERATOR`), account activation/deactivation, password reset, and permission matrix inspection.
- **User Roles:** `ADMIN`.
- **Important Workflows:** Admin provisions new Librarian account -> assigns role -> user logs in and accesses authorized circulation and cataloguing modules while system settings remain blocked.
- **Backend/API Integration:** `GET/POST /api/v1/system/users`, `GET /api/v1/system/roles`.
- **Verification Evidence:** `backend/tests/rbac.test.ts` (3/3 PASS; Exit Code 0).

---

### Module 20: Audit Trail & Compliance Logs
- **Route:** `/audit`
- **Purpose:** Immutable compliance logging, security auditing, and institutional activity tracking.
- **Main Functionality:** Chronological immutable audit log, action filtering (`CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `CHECKOUT`, `GATE_ALARM`), actor tracking, client IP capture, and structured JSON before/after state inspector.
- **User Roles:** `ADMIN` strictly (Librarians and Operators denied with 403 Forbidden).
- **Important Workflows:** Critical system operations automatically generate non-modifiable audit records with timestamps and actor IDs -> Admin audits compliance log.
- **Backend/API Integration:** `GET /api/v1/audit-logs`.
- **Verification Evidence:** `backend/tests/rbac.test.ts` (deny Librarian / allow Admin) & verified 20 records returned.

---

### Module 21: System Health, Backup & Diagnostics
- **Route:** `/backup`
- **Purpose:** System telemetry monitoring, automated disaster recovery, database backup, and controlled update rollback.
- **Main Functionality:** System liveness metrics, database pooler latency probe, pre-update SQL backup creation, SHA-256 manifest verification, automated rollback on failure, and isolated schema restore.
- **User Roles:** `ADMIN`.
- **Important Workflows:** Trigger manual or pre-update database backup -> verify SHA-256 checksum -> restore into isolated test schema to verify backup integrity without affecting production tables.
- **Backend/API Integration:** `GET /api/v1/system/health`, `POST /api/v1/system/backup`, `POST /api/v1/system/restore`.
- **Verification Evidence:** `backend/tests/phase4f-updates-recovery.test.ts` (10/10 PASS) & `tests/phase5b-acceptance.test.ts` (Test 5 PASS).

---

### Module 22: Public OPAC & Virtual Bookshelf
- **Route:** `/opac`, `/bookshelf`
- **Purpose:** Unauthenticated public discovery portal and personalized patron reading lists.
- **Main Functionality:** Unauthenticated catalog search, multi-field relevance ranking (title, author, subject, ISBN), copy availability badge without patron PII, external Net Cataloguing bibliographic lookup, and private Virtual Bookshelf reading list manager.
- **User Roles:** Public, Student, Faculty, Staff.
- **Important Workflows:** Patron searches catalog without logging in -> views physical shelf availability -> adds book to private Virtual Bookshelf list -> imports missing bibliographic records via Net Cataloguing.
- **Backend/API Integration:** `GET /api/v1/opac/search`, `POST /api/v1/opac/bookshelf/items`, `GET /api/v1/opac/net-cataloguing`.
- **Verification Evidence:** `backend/tests/phase5a-gap-closure.test.ts` (Test 4 PASS; Exit Code 0) & `phase5a.test.tsx` (Test 1 PASS).

