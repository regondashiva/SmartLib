# SmartLib v1.6.0 — Final Database Health Report

**Audit Date:** November 10, 2026  
**Auditor:** AISYS Database Administration & Persistence Audit  
**Target Engine:** Neon Serverless PostgreSQL  
**Engine Version:** PostgreSQL 18.6 (`ac70818` on aarch64-unknown-linux-gnu)  
**ORM:** Prisma Client v6.3.1  
**Database Health Status:** **HEALTHY / CONNECTED**

---

## 1. Live Database Telemetry & Entity Counts

The active database instance was queried directly via read-only introspection queries on November 10, 2026:

| Entity Table | Model Name | Live Record Count | Integrity Status | Primary Keys / Indexes |
|---|---|---|---|---|
| `users` | `User` | **7** | Healthy | UUID primary key; unique index on `email`. |
| `roles` | `Role` | **4** | Healthy | System roles: `ADMIN`, `LIBRARIAN`, `STAFF`, `RFID_OPERATOR`. |
| `books` | `Book` | **29** (all active) | Healthy | Unique index on `isbn13`; foreign keys to `Publisher` & `Category`. |
| `book_items` | `BookItem` | **50** | Healthy | Unique on `accessionNumber`; unique on `barcode`; FK to `Book`. |
| `members` | `Member` | **8** | Healthy | Unique on `cardNumber`; unique on `smartCardUid`; unique `email`. |
| `circulations` | `Circulation` | **12** | Healthy | FKs to `Member`, `BookItem`, `User`; tracked `dueDate` & `status`. |
| `fines` | `Fine` | **0** (settled) | Healthy | Indexed on `memberId`, `circulationId`; tracks payment/waiver. |
| `rfid_tags` | `RFIDTag` | **21** | Healthy | Unique on `epc`; unique on `tid`; bound to `BookItem`. |
| `gate_events` | `GateEvent` | **5** | Healthy | Indexed on `timestamp`, `eventType`, `easArmed` status. |
| `audit_logs` | `AuditLog` | **597** | Healthy | Append-only chronological log with JSON details and actor ID. |
| `migration_batches` | `MigrationBatch` | **4** | Healthy | Tracks status (`COMMITTED`, `VALIDATED`), checksums, dry-run stats. |
| `notifications` | `Notification` | **15** | Healthy | Queue table tracking `PENDING`, `SENT`, `FAILED` with retry counts. |

---

## 2. Integrity Constraints & Business Enforcements

1. **Accession Number Format & Uniqueness:**
   - Format: `ACC-YYYY-XXXXX` (e.g. `ACC-2026-00052`).
   - Guarded by PostgreSQL unique constraint on `book_items(accessionNumber)`.
2. **Barcode Deduplication:**
   - Barcode identifiers (e.g. `BC-ACC-2026-00052`) are strictly unique across all physical copies.
3. **RFID EPC & TID Binding:**
   - Physical RFID tags maintain unique EPC hex strings and unique factory TIDs. The database schema forbids re-encoding the same EPC to two distinct physical books simultaneously.
4. **Soft Deletion Architecture:**
   - Bibliographic records and copies support non-destructive soft deletion via `deletedAt DateTime?`. Active queries filter out soft-deleted records (`where: { deletedAt: null }`).

---

## 3. Seed Accounts & Institutional Users

The database currently maintains 7 staff accounts:
- `admin@smartlib.institution.edu` (ADMIN — System Administrator)
- `admin@smartlib.ac.in` (ADMIN — Evaluator Quick Access)
- `librarian@smartlib.institution.edu` (LIBRARIAN — Chief Librarian)
- `librarian@smartlib.ac.in` (LIBRARIAN — Evaluator Quick Access)
- `admin.phase5b@smartlib.local` (ADMIN — Acceptance Test Service Account)
- `librarian.phase5b@smartlib.local` (LIBRARIAN — Acceptance Test Service Account)
- `operator.phase5b@smartlib.local` (RFID_OPERATOR — Hardware Specialist)

---

## 4. Backup & Disaster Recovery Assessment

- **SQL Backup Engine:** Implemented in `postgres-backup-restore.ts`. Backs up DDL schemas, constraints, sequences, and table rows using parameterized SQL chunking.
- **Checksum Verification:** Every backup file generates an accompanying SHA-256 checksum manifest.
- **Restoration Scope:** Successfully verified via test `phase5b-acceptance.test.ts` (Test 5), creating and restoring an isolated schema (`smartlib_pg_rst_420155`) on the target PostgreSQL server.
- **Air-Gapped Note:** Full offline host recovery without internet requires a locally installed PostgreSQL instance (e.g., PostgreSQL MSI on Windows Server) as documented in `FINAL_KNOWN_LIMITATIONS.md`.

