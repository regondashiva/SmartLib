# SmartLib Phase 4F — Offline Installation, Updates, Rollback & Recovery Test Report

> Phase 4F | Verification & Regression Test Report  
> Environment: Live Neon PostgreSQL + Express Backend + React 19 / Vitest Frontend + PowerShell Offline Scripts

---

## 1. Backend Integration Test Suite (`backend/tests/phase4f-updates-recovery.test.ts`)

Executed against live Neon PostgreSQL via Supertest & Prisma:

| # | Category | Test Case | Status |
|---|---|---|---|
| 1 | Version & Diagnostics | `GET /api/v1/system/version` returns installed version (`1.4.0`), manifest, health checks (`HEALTHY`), RFID SQLite buffer status, and documented offline database limitation | **PASS** |
| 2 | RBAC Security | Rejects `LIBRARIAN` and `STUDENT` tokens with `403 Forbidden` on `/api/v1/system/*` endpoints | **PASS** |
| 3 | Package Management | Validates a valid `v1.5.0` manifest with matching 64-char SHA-256 bundle checksums (`valid: true`) | **PASS** |
| 4 | Package Management | Rejects corrupted package (SHA-256 mismatch), path traversal (`../../etc/malicious.tar.gz`), unmet `minSupportedUpgradeVersion` (`1.8.0`), unsupported Node/Python/disk space, and destructive non-backward-compatible migrations | **PASS** |
| 5 | Backup & Restore | Creates verified database snapshot on disk (`201 Created`), verifies restore readiness (`DRY_RUN_VERIFY`), and blocks unconfirmed `FULL_RESTORE` (`400 Bad Request`) | **PASS** |
| 6 | Backup Integrity | Detects file tampering on disk during `POST /api/v1/system/backups/verify` (`400 Bad Request — SHA-256 mismatch`) | **PASS** |
| 7 | Controlled Update | Aborts update safely before modifying application version when pre-update backup fails (`BACKUP_FAILURE`) | **PASS** |
| 8 | Automatic Rollback | Automatically rolls back to last known-good version (`1.4.0`) and sets state `ROLLED_BACK` when post-update health check fails (`HEALTH_CHECK_FAILURE`) | **PASS** |
| 9 | Controlled Update | Executes full 11-step update from `v1.4.0` to `v1.5.0` (`COMPLETED`), creates pre-update backup, and preserves 100% of existing book and member records | **PASS** |
| 10 | Manual Rollback & Audit | Rejects unconfirmed database restore during rollback (`400`), executes clean rollback from `v1.5.0` to `v1.4.0` (`ROLLED_BACK`), verifies post-rollback health, and records `MANUAL_ROLLBACK_EXECUTED` in `/api/v1/system/history` | **PASS** |

---

## 2. Frontend Unit & Component Test Suite (`frontend/src/tests/backup-updates.test.tsx`)

Executed in Vitest + React Testing Library:

| # | Test Case | Description | Status |
|---|---|---|---|
| 1 | Version, State Machine & Health Rendering | Renders installed version (`v1.4.0`), update state badge (`IDLE`), PostgreSQL connectivity check, and RFID SQLite offline buffer compatibility | **PASS** |
| 2 | Package Validation & Controlled Update Execution | Validates manifest JSON via `/system/packages/validate`, opens confirmation dialog, and executes `/system/updates/execute` | **PASS** |
| 3 | Database Backups & Restore Verification | Displays verified backups table with SHA-256 digests and triggers `/system/backups/verify` (`DRY_RUN_VERIFY`) | **PASS** |
| 4 | Safe Rollback & Update Operation History | Opens rollback confirmation modal, executes `/system/rollback`, and renders audit log entries in the History tab | **PASS** |

---

## 3. RFID Offline Event Queue & Build Verification

- **RFID SQLite Buffer Compatibility**: Verified `rfid-service/buffer/offline_sync.py` preserves `UNIQUE(event_id)` idempotency, hardware timestamps, and FIFO ordering across backend restarts and application updates.
- **PowerShell Offline Installer Dry-Run (`deploy/offline-package/scripts/install-offline.ps1 -DryRun`)**: Verified manifest loading, OS detection, Node.js >= 20, Python >= 3.11, free disk space, and frontend bundle presence (`EXIT 0`).
- **Backend TypeScript Compilation (`tsc --noEmit`)**: **0 errors** (`EXIT 0`).
- **Frontend Production Build (`npm --prefix frontend run build`)**: **0 errors** (`EXIT 0`).

