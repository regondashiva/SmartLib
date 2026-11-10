# SmartLib Phase 4F — Controlled Update, Backup Verification & Rollback Runbook

## 1. Controlled Update Lifecycle (11-Step State Machine)

Every SmartLib application update progresses through a strict, non-concurrent state machine managed by `SystemLifecycleService`:

`IDLE` → `PENDING` → `VALIDATING` → `BACKING_UP` → `APPLYING` → `VERIFYING` → `COMPLETED`  
*(On any post-backup failure: `FAILED` → `ROLLING_BACK` → `ROLLED_BACK`)*

### The 11 Controlled Steps:
1. **Discover Update Package**: Load target `version-manifest.json`.
2. **Check Current & Target Versions**: Ensure target `appVersion >= currentVersion` and `currentVersion >= minSupportedUpgradeVersion`.
3. **Validate Package Integrity & Archive Safety**: Verify 64-character SHA-256 digests for `frontendBundle`, `backendBundle`, `rfidMiddlewareBundle`, and `databaseSchemaBundle`. Reject any path containing `..`, `/`, or `\`.
4. **Check Disk Space & Runtime Prerequisites**: Confirm Node.js `>= 20.0.0`, Python `>= 3.11.0`, and `>= 500 MB` free disk space.
5. **Create & Verify Pre-Update Database Backup**: Verify live PostgreSQL connectivity (`SELECT 1`), write logical snapshot to `data/backups/bkp-<version>-<timestamp>.json`, re-read from disk, and verify SHA-256 checksum match before proceeding.
6. **Database Migration Compatibility Check**: Reject packages with `destructiveChanges: true` and `backwardCompatible: false`.
7. **Preserve Last Known-Good Baseline**: Record current version and manifest in `DEPLOY_LAST_KNOWN_GOOD_VERSION` and `DEPLOY_LAST_KNOWN_GOOD_MANIFEST`.
8. **Apply Application Update**: Transition active configuration and component versions to the target release.
9. **Verify RFID Offline Queue Continuity**: Confirm `rfid-service/data/offline_events.db` WAL queue remains intact.
10. **Execute Post-Update Health Checks**: Run database connectivity, schema integrity, runtime, and RFID queue checks.
11. **Finalize or Auto-Rollback**: Mark update `COMPLETED` only if all checks pass. If migration or health verification fails, automatically roll back to the preserved last known-good version (`ROLLED_BACK`).

---

## 2. Pre-Update Backup & Restore Verification Procedure

SmartLib never assumes a backup is restorable merely because file creation succeeded.

### Creating a Verified Backup
- **UI**: Navigate to **Backup & Updates → Database Backups & Verify** and click **Create Verified Backup**.
- **API**: `POST /api/v1/system/backups` with `{ "label": "Pre-Upgrade Snapshot", "isKnownGood": true }`.
- **Protection Rule**: Existing known-good backup files are written with exclusive flag (`wx`) and are never overwritten automatically.

### Verifying Restore Readiness (`DRY_RUN_VERIFY`)
- **UI**: Click **Verify Restore** next to any backup in the table.
- **API**: `POST /api/v1/system/backups/verify` with `{ "backupId": "<id>", "mode": "DRY_RUN_VERIFY" }`.
- **Verification Steps Performed**:
  1. Confirms snapshot file exists on disk.
  2. Recomputes SHA-256 digest of the file on disk and compares it against the recorded `sha256` in `DEPLOY_BACKUP_REGISTRY` (detecting any bit-rot or tampering).
  3. Parses JSON structure and verifies format header `SMARTLIB_POSTGRESQL_LOGICAL_BACKUP_V1`, `tableCounts`, and `data` payload.
  4. Marks backup status as `RESTORE_TESTED` with `restoreVerifiedAt` timestamp and writes an audit log entry.

---

## 3. Safe Rollback & Recovery Procedure

### Scenario A: Automatic Rollback After Failed Update
If an update fails during `APPLYING` or `VERIFYING` (e.g., post-update health check failure), `SystemLifecycleService` automatically restores `DEPLOY_CURRENT_VERSION` and `DEPLOY_CURRENT_MANIFEST` to the last known-good version and logs `UPDATE_FAILED_AUTO_ROLLED_BACK`.

### Scenario B: Manual Administrative Rollback
1. Open **Backup & Updates → Rollback & Recovery** (`/backup`).
2. Enter an administrative justification in **Rollback Reason**.
3. Click **Roll Back to Last Known-Good Version**.
4. **Database Safety Policy**:
   - Standard application rollback reverts the application version while leaving all PostgreSQL catalog, patron, loan, and fine records untouched.
   - If **Also restore configuration state from pre-update database backup snapshot** is checked, the administrator **must** explicitly check the confirmation box acknowledging that settings modified after the backup timestamp may be affected (`confirmDataLossWarning: true`).
5. Verify post-rollback health checks show `HEALTHY`.

