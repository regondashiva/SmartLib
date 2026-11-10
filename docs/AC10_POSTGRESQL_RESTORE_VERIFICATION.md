# SmartLib — AC10 Real PostgreSQL Backup, Simulated Failure & Isolated Restore Verification Report

**Document ID:** `VER-AC10-5B`  
**Phase:** Phase 5B Final Acceptance Verification  
**Verification Date:** November 9, 2026  
**Status:** **PASS (Verified via Real PostgreSQL SQL DDL+DML Dump & Isolated Target Restore)**

---

## 1. Distinction Between Logical JSON Snapshots and Real PostgreSQL SQL Restore

In accordance with Phase 5B strict verification rules, a JSON snapshot or `DRY_RUN_VERIFY` check is **not** treated as a PostgreSQL restore. Instead, [`executeRealPostgresBackupAndIsolatedRestore`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/backend/src/modules/system/postgres-backup-restore.ts) (`POST /api/v1/system/postgresql-restore-test`) performs a real SQL-level PostgreSQL backup, destructive failure simulation, and restoration into a separate isolated target PostgreSQL schema (`smartlib_pg_rst_<id>`) on the live PostgreSQL 17 server while keeping the primary `public` schema untouched.

---

## 2. Step-by-Step Execution & Recorded Metrics

1. **Database Environment Recorded:**
   - **Engine:** PostgreSQL 17 (`Neon Serverless PostgreSQL`)
   - **Isolated Source Schema:** `smartlib_pg_src_<id>` (8 relational tables with `PRIMARY KEY` and `FOREIGN KEY` constraints: `publishers`, `categories`, `books`, `rfid_tags`, `book_items`, `members`, `circulations`, `fines`)
   - **Isolated Restore Target Schema:** `smartlib_pg_rst_<id>`
2. **Real PostgreSQL SQL Backup Created:**
   - **Output File:** `data/backups/postgresql_real_dump_<id>.sql`
   - **Contents:** Executable PostgreSQL `CREATE SCHEMA`, `CREATE TABLE` (with `REFERENCES ... ON DELETE RESTRICT/CASCADE`), and `INSERT INTO` statements.
   - **Integrity Verification:** SHA-256 checksum computed and verified from disk prior to restoration.
3. **Simulated Failed Migration / Destructive Corruption on Source:**
   - Executed `DROP TABLE circulations CASCADE`, `DROP TABLE fines CASCADE`, and `DELETE FROM book_items` against `smartlib_pg_src_<id>`.
   - Verified `circulationsTableDropped = true` and `bookItemsRemainingInCorruptedSource = 0`.
4. **Restoration into Separate Isolated Target (`smartlib_pg_rst_<id>`):**
   - Executed the `.sql` dump against `smartlib_pg_rst_<id>`.
   - Verified all 8 tables in `information_schema.tables`: `books` (2), `book_items` (2), `categories` (2), `circulations` (1), `fines` (1), `members` (2), `publishers` (2), `rfid_tags` (2).
   - Verified 7-table `INNER JOIN` relational query (`circulations ⋈ book_items ⋈ books ⋈ publishers ⋈ rfid_tags ⋈ members ⋈ fines`) returning `accessionNumber: "ACC-5B-00001"`, `tagEpc: "3034257BF400B5B000000001"`, `memberCardNumber: "MEM-5B-001"`, `fineAmount: "15.00"`.
5. **Primary Database Preservation:**
   - Pre-test and post-test row counts in the `public` schema (`Book`, `Member`, `Circulation`) matched 100% with zero mutations.

