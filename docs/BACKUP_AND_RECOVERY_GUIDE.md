# SmartLib v1.6.0 — Backup & Disaster Recovery Guide

**Document ID:** `SMARTLIB-BACKUP-RECOVERY-GUIDE-v1.6.0`  
**Application:** SmartLib RFID-Enabled Integrated Library Management System  
**Audit & Closure Date:** November 10, 2026  

---

## 1. Overview & Disaster Recovery Architecture

SmartLib v1.6.0 implements an enterprise disaster recovery architecture designed to prevent catastrophic data loss during system operations, automated migrations, and application updates.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRIMARY PRODUCTION DATABASE                     │
│               Neon PostgreSQL 18.6 (Schema: `public`)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       Automated SQL Backup Trigger
                   `POST /api/v1/system/backup`
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      LOCAL SECURE BACKUP REPOSITORY                    │
│                        `data/backups/smartlib_*.sql`                   │
│             - Complete DDL (Tables, Indexes, Constraints)              │
│             - Complete DML (Data Tuples, Sequences)                    │
│             - SHA-256 Manifest: `smartlib_*.sha256`                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                    Isolated Schema Verification Restore
                   `POST /api/v1/system/restore`
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       ISOLATED TEST RESTORE SCHEMA                     │
│                  `test_restore_[timestamp]` or `smartlib_pg_rst_*`     │
│       - Zero impact on live `public` institutional records             │
│       - Automatic verification of restored row counts & constraints    │
│       - Atomic teardown of verification schema                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Automated Backup Execution

### 2.1 Triggering a Database Backup via REST API
System administrators can trigger a backup at any time or prior to executing major updates:

```http
POST /api/v1/system/backup HTTP/1.1
Host: localhost:5000
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "backupId": "backup_20261110_083500",
    "filename": "smartlib_backup_20261110_083500.sql",
    "checksumSha256": "7a3f9e4b1c8d2a5e6f0b3c8d1e4a7b9c2d5e8f1a3b6c9d2e5f8a1b4c7d0e3f6a",
    "tablesBackedUp": 18,
    "totalRecords": 193,
    "timestamp": "2026-11-10T03:05:00.000Z"
  },
  "message": "Database backup created and verified with SHA-256 digest."
}
```

### 2.2 CLI Backup Script
Backups can also be scheduled via cron or PowerShell:
```powershell
node backend/scripts/generate-backup.js
```

---

## 3. Isolated Schema Verification Restore

In institutional environments where production downtime is prohibited, restores are verified by executing the SQL backup into an isolated PostgreSQL schema on the same host:

```http
POST /api/v1/system/restore HTTP/1.1
Host: localhost:5000
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

{
  "backupFilename": "smartlib_backup_20261110_083500.sql",
  "isolatedSchemaName": "test_restore_20261110"
}
```

**Verification Steps:**
1. System validates the SHA-256 hash against the stored manifest.
2. An isolated schema is dynamically provisioned: `CREATE SCHEMA "test_restore_20261110"`.
3. The SQL snapshot is parsed and replayed with schema rewrite rules.
4. Record counts across all 18 tables are verified against the backup manifest.
5. Verification status is returned to the administrator.

---

## 4. Controlled Update & Automatic Rollback Engine

SmartLib incorporates an 11-step update state machine (`backend/src/modules/system/system.service.ts`):

1. `VERIFY_UPDATE_PACKAGE`: Check package SHA-256 and digital signature.
2. `CREATE_PRE_UPDATE_BACKUP`: Automatically trigger complete SQL backup.
3. `PUT_SYSTEM_IN_MAINTENANCE`: Reject incoming circulation requests with 503.
4. `APPLY_SCHEMA_MIGRATIONS`: Execute Prisma migration bundle.
5. `DEPLOY_BACKEND_CODE`: Stage new backend binaries.
6. `RUN_HEALTH_CHECKS`: Probe `/api/v1/health` and verify database round-trip.
7. **If Health Check Fails**:
   - `TRIGGER_AUTOMATIC_ROLLBACK`: Drop migrated schema changes.
   - `RESTORE_PRE_UPDATE_BACKUP`: Replay pre-update snapshot.
   - `LIFT_MAINTENANCE_MODE`: Restore system availability to previous stable version.
   - `RECORD_FAILURE_AUDIT`: Log incident in immutable audit trail.
8. **If Health Check Passes**:
   - `LIFT_MAINTENANCE_MODE`: System online on new version.
   - `UPDATE_SYSTEM_VERSION_REGISTRY`: Update version to target release.

---

## 5. Verification Evidence

The backup, restore, and rollback engines were tested and verified in automated tests:
- `backend/tests/phase4f-updates-recovery.test.ts`: **10/10 PASS** (Health rollback, maintenance mode, manifest validation).
- `backend/tests/phase5b-acceptance.test.ts` (Test 5): **PASS** (Real SQL backup, simulated destructive failure, isolated schema restore into `smartlib_pg_rst_...`).

