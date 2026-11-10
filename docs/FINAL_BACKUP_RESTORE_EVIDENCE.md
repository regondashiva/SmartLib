# SmartLib v1.6.0 — Final PostgreSQL Backup & Restore Verification Evidence

**Document ID:** `FINAL-BACKUP-RESTORE-EVIDENCE-v1.6.0`  
**Audit Date:** November 9, 2026  
**Implementation File:** [`backend/src/modules/system/postgres-backup-restore.ts`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/backend/src/modules/system/postgres-backup-restore.ts)  
**Test File:** [`backend/tests/phase5b-acceptance.test.ts`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/backend/tests/phase5b-acceptance.test.ts) (Test 5)

---

## 1. SQL Backup Creation Method

Because the Windows 11 evaluation host does not have `pg_dump.exe` or `psql.exe` installed (`C:\Program Files\PostgreSQL\18\bin` is absent), SmartLib implements two distinct backup mechanisms that are documented separately:

1. **Application-Level Logical JSON Snapshots (`POST /api/v1/system/backups` in `system.service.ts`):**
   - Exports application table rows to `data/backups/bkp-*.json` with SHA-256 integrity hashes and `DRY_RUN_VERIFY` checks. **This JSON snapshot is NOT claimed as a PostgreSQL database restore.**
2. **Executable PostgreSQL SQL DDL+DML Backup & Isolated-Schema Restore (`POST /api/v1/system/postgresql-restore-test` in `postgres-backup-restore.ts`):**
   - Connects to the live PostgreSQL server via Prisma (`$executeRawUnsafe` / `$queryRawUnsafe`), provisions an isolated source schema (`smartlib_pg_src_420155`), creates 8 relational tables with `PRIMARY KEY`, `UNIQUE`, and `FOREIGN KEY` (`ON DELETE RESTRICT` / `ON DELETE CASCADE`) constraints, populates synthetic institutional records, and writes an executable SQL dump file (`data/backups/postgresql_real_dump_420155.sql`) containing standard PostgreSQL `CREATE SCHEMA`, `CREATE TABLE`, and `INSERT INTO` statements.

---

## 2. Recorded Backup Artifact Metadata (From Actual Execution)

- **Backup File Path:** [`data/backups/postgresql_real_dump_420155.sql`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/data/backups/postgresql_real_dump_420155.sql)
- **File Size:** `4,911 bytes` (`17` executable SQL DDL/DML statements)
- **SHA-256 Checksum:** `a9f21ab2117f797796d14ce664883dadb4f31afa99f3bda122f2ce5343a9d2bf`
- **Recorded Database Server Version:**
  ```text
  PostgreSQL 18.6 (ac70818) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit
  ```
- **Backup Timestamp (UTC):** `2026-11-09T16:40:33.846Z`
- **Isolated Source Schema:** `smartlib_pg_src_420155`
- **Isolated Restore Target Schema:** `smartlib_pg_rst_420155`

---

## 3. Simulated Failure & Isolated-Schema Restoration Verification

1. **Simulated Destructive Migration Failure on Source Schema (`smartlib_pg_src_420155`):**
   - Executed destructive SQL statements against the source schema:
     ```sql
     DROP TABLE "smartlib_pg_src_420155"."fines" CASCADE;
     DROP TABLE "smartlib_pg_src_420155"."circulations" CASCADE;
     DELETE FROM "smartlib_pg_src_420155"."book_items";
     ```
   - Verified corruption via `information_schema.tables` (`circulationsTableDropped: true`) and `SELECT COUNT(*)` (`bookItemsRemainingInCorruptedSource: 0`).
2. **Restoration into Separate Isolated Target Schema (`smartlib_pg_rst_420155`):**
   - Re-read `data/backups/postgresql_real_dump_420155.sql` from disk, verified its SHA-256 digest (`a9f21ab2117f797796d14ce664883dadb4f31afa99f3bda122f2ce5343a9d2bf`), bound `{{TARGET_SCHEMA}}` to `smartlib_pg_rst_420155`, and executed all 17 SQL statements against PostgreSQL.
3. **Verified Restored Table & Row Counts in `smartlib_pg_rst_420155`:**
   - `publishers`: **2 rows** (`MIT Press`, `O'Reilly Media`)
   - `categories`: **2 rows** (`Computer Science`, `Distributed Systems`)
   - `books`: **2 rows** (`9780262510875`, `9781449373320`)
   - `rfid_tags`: **2 rows** (`3034257BF400B5B000000001`, `3034257BF400B5B000000002`)
   - `book_items`: **2 rows** (`ACC-5B-00001`, `ACC-5B-00002`)
   - `members`: **2 rows** (`MEM-5B-001`, `MEM-5B-002`)
   - `circulations`: **1 row** (`circ-1`, status `ACTIVE`)
   - `fines`: **1 row** (`fine-1`, amount `15.00`, status `UNPAID`)
4. **Verified 7-Table Relational Join & Primary `public` Schema Preservation:**
   - Executed a 7-table `INNER JOIN` (`circulations ⋈ book_items ⋈ books ⋈ publishers ⋈ rfid_tags ⋈ members ⋈ fines`) in `smartlib_pg_rst_420155`, confirming intact foreign keys.
   - Verified that `public` schema counts (`Book`, `Member`, `Circulation`) were 100% unchanged before and after the test.

---

## 4. Honest Boundary: Isolated-Schema Restore vs. Full Database-Server Disaster Recovery

- **What This Proves:** Real SQL DDL+DML generation, SHA-256 verification on disk, schema/table/constraint creation, relational data restoration, and post-restore SQL query access inside an isolated PostgreSQL schema (`smartlib_pg_rst_420155`).
- **What This Does Not Claim:** Because `pg_dump.exe` / `pg_restore.exe` are not installed on the Windows 11 host and the database is hosted on a managed Neon PostgreSQL instance, this test restores into an isolated schema within the same PostgreSQL database (`neondb`) rather than executing a bare-metal `pg_restore` across two independent physical PostgreSQL server instances.

