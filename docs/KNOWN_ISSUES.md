# SmartLib — Known Issues, Defects & Operational Backlog

**Classification Framework:** High / Medium / Low / Operational Backlog  
**Audit Date:** 2026-11-06

---

## 1. Summary of Identified Defects & Remediation Status

| ID | Module | Description | Severity | Resolution / Workaround | Status |
|---|---|---|---|---|---|
| **ISSUE-01** | Auth / Frontend | Login expected `res.data.data.accessToken`, but backend returned `res.data.data.tokens.accessToken`. | Medium | Updated `AuthContext.tsx` to unpack `payload.tokens?.accessToken \|\| payload.accessToken`. | **RESOLVED** |
| **ISSUE-02** | Seed Credentials | Frontend demo hint suggested `admin@smartlib.ac.in`, but Neon seed only contained `admin@smartlib.institution.edu`. | Medium | Seeded both `*.ac.in` and `*.institution.edu` credential pairs in Neon DB. | **RESOLVED** |
| **ISSUE-03** | Frontend Build | Vite TypeScript build flagged deprecated `baseUrl` in `tsconfig.json`. | Low | Removed `baseUrl` in favor of TypeScript 7 `paths` mapping. | **RESOLVED** |
| **ISSUE-04** | Circulation Returns | Check-in / return endpoint (`POST /circulation/return`) not yet present in Express backend. | Medium | UI buttons labeled "Awaiting POST /api/v1/circulation/return"; domain logic prepared. | **BACKLOG** |
| **ISSUE-05** | Cataloguing API | Book ingestion endpoint (`POST /api/v1/books`) not yet present in Express backend. | Medium | UI forms staged with client-side validation; backend endpoint scheduled for Phase 4. | **BACKLOG** |
| **ISSUE-06** | Gate Event Sync | RFID sync endpoint (`POST /api/v1/rfid/gate-events`) not yet present on Express backend. | Low | Edge SQLite buffer cleanly catches transient rejections and queues records safely. | **BACKLOG** |

---

## 2. Interactive UI Action Inventory (Buttons & Forms)

As required by the audit specification, every button and form across the 17 frontend modules was inspected:

### Fully Functional Live Actions:
- **Sign In Form (`/login`)**: Transmits credentials, authenticates with Express, persists JWT.
- **Global Search & Filter Bar (`/books`, `/members`)**: Queries backend database with live debouncing.
- **Book Issue Form (`/circulation`)**: Issues circulating book copies, disarms EAS transponder bit, records active loan in Neon.
- **RFID Staff Flatbed Reader (`/rfid/tagging`)**: Triggers physical EPC tag reads against FastAPI middleware.
- **Handheld Shelf Sweep (`/inventory`)**: Executes shelf audits against FastAPI handheld reader driver.
- **Security Gate Simulator (`/security-gate`)**: Dispatches pedestrian transit events, trips anti-theft alarms, verifies CCTV frames.
- **Audit Log Refresher (`/audit`)**: Fetches live compliance logs for `ADMIN` role.

### Staged Mock / Awaiting Backend Actions:
- **Add Book Form (`/cataloguing`)**: Bibliographic inputs staged; submit button disabled until `POST /books` is available.
- **Loan Renew & Return Buttons (`/circulation`)**: Disabled with explanatory tooltip until renewal/return endpoints are added.
- **Migration File Dropzone (`/migration`)**: Staging preview active; migration trigger disabled until `/api/v1/migration` is built.
- **Report PDF Export (`/reports`)**: Report cards rendered; export action disabled until report compiler is wired.
- **Add Staff Account (`/users`)**: Staff roster rendered; account creation modal awaits user management API.

