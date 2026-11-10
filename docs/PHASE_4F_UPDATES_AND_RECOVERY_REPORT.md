# SmartLib Phase 4F — Offline Installation, Updates, Rollback & Recovery
## Implementation & Verification Report

> Phase 4F | Offline Installation, Updates, Rollback & Recovery  
> Status: **COMPLETE** | November 2026  
> Preceding Phases: 1 → 2A → 2B → 2C → 3 → 4A → 4B → 4C → 4D → 4E → **4F**

---

## Executive Summary

Phase 4F delivers an enterprise **Offline Deployment, Controlled Update Lifecycle, Pre-Update Database Backup Verification, and Safe Rollback & Recovery** system for SmartLib. Administrators can validate offline update packages (`version-manifest.json`), verify SHA-256 bundle checksums, create and restore-test PostgreSQL snapshots before applying updates, monitor an 11-step update state machine (`IDLE`, `PENDING`, `VALIDATING`, `BACKING_UP`, `APPLYING`, `VERIFYING`, `COMPLETED`, `FAILED`, `ROLLING_BACK`, `ROLLED_BACK`), and safely roll back to the last known-good version without losing library records or queued RFID events.

---

## 1. Architectural Distinction: Offline Capabilities vs. PostgreSQL Connectivity

SmartLib strictly separates and documents three distinct operational capabilities:

1. **Offline Package Installation & Controlled Updates (Supported)**:
   - All application components (Frontend production bundle, Backend compiled artifacts, RFID FastAPI middleware, Prisma schema/migrations, Docker Compose definition, and PowerShell lifecycle scripts) are packaged under [`deploy/offline-package/`](../deploy/offline-package) with a signed [`version-manifest.json`](../deploy/offline-package/version-manifest.json).
   - Installation and updates do not require internet access to npm or PyPI registries when local runtime prerequisites are installed.
2. **RFID SQLite Offline Event Queue (Supported During Outages & Updates)**:
   - The Python FastAPI RFID middleware ([`rfid-service/buffer/offline_sync.py`](../rfid-service/buffer/offline_sync.py)) persists security gate passages and reader tag scans locally in `rfid-service/data/offline_events.db` during backend downtime, network interruptions, backend restarts, or application updates/rollbacks.
   - Enforces idempotency (`UNIQUE(event_id)`), preserves original hardware timestamps (`hardware_timestamp`), maintains FIFO ordering (`ORDER BY id ASC`), and automatically synchronizes with exponential retry backoff (`MAX_SYNC_RETRIES=5`) once the backend API is healthy.
3. **Full-Application Offline Database Limitation (Documented Architectural Boundary)**:
   - SmartLib uses **Neon Serverless PostgreSQL** (or an institutional PostgreSQL 15+ instance configured via `DATABASE_URL`) as its primary transactional database.
   - While RFID gate/scanner telemetry buffers offline in SQLite, full catalog, patron, and circulation transactions require network connectivity to the configured PostgreSQL endpoint. SmartLib never silently substitutes an unverified local database for primary circulation operations.

---

## 2. Offline Installation Package Structure

Located under [`deploy/offline-package/`](../deploy/offline-package):

- [`version-manifest.json`](../deploy/offline-package/version-manifest.json) — Application version (`1.4.0`), component versions, minimum upgrade baseline (`1.0.0`), required runtimes (`Node.js >= 20.0.0`, `Python >= 3.11.0`, `PostgreSQL >= 15.0`), migration compatibility flags, SHA-256 bundle checksums, and release notes.
- [`docker-compose.offline.yml`](../deploy/offline-package/docker-compose.offline.yml) — Offline multi-container deployment configuration (`smartlib-backend`, `smartlib-rfid-middleware`, `smartlib-frontend`) using external `.env` files with zero embedded secrets.
- **Environment Variable Templates** (no secrets, passwords, or JWT keys packaged):
  - [`env-templates/backend.env.example`](../deploy/offline-package/env-templates/backend.env.example)
  - [`env-templates/frontend.env.example`](../deploy/offline-package/env-templates/frontend.env.example)
  - [`env-templates/rfid-service.env.example`](../deploy/offline-package/env-templates/rfid-service.env.example)
- **PowerShell Lifecycle Scripts** (Windows 11 & Windows Server 2022+ compatible):
  - [`scripts/install-offline.ps1`](../deploy/offline-package/scripts/install-offline.ps1) — Validates manifest JSON, OS version, Node.js >= 20, Python >= 3.11, free disk space (>= 500 MB), and frontend production build artifacts.
  - [`scripts/update-smartlib.ps1`](../deploy/offline-package/scripts/update-smartlib.ps1) — Validates target manifest before executing controlled update.
  - [`scripts/rollback-smartlib.ps1`](../deploy/offline-package/scripts/rollback-smartlib.ps1) — Emergency operator rollback utility preserving PostgreSQL data and RFID SQLite queue.

---

## 3. Backend Lifecycle & Recovery APIs (`/api/v1/system`)

Implemented in [`backend/src/modules/system/system.schema.ts`](../backend/src/modules/system/system.schema.ts), [`system.service.ts`](../backend/src/modules/system/system.service.ts), [`system.controller.ts`](../backend/src/modules/system/system.controller.ts), and [`system.routes.ts`](../backend/src/modules/system/system.routes.ts) (restricted strictly to `ADMIN`):

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/v1/system/version` | `GET` | `ADMIN` | Installed version, last known-good version, update state machine, manifest, backups, and diagnostics |
| `/api/v1/system/diagnostics` | `GET` | `ADMIN` | Post-update health checks (PostgreSQL latency, schema integrity, runtime version, RFID SQLite buffer) |
| `/api/v1/system/packages/validate` | `POST` | `ADMIN` | Validates `version-manifest.json`, SHA-256 digests, path traversal protection, runtime prerequisites, and migration safety |
| `/api/v1/system/backups` | `POST` | `ADMIN` | Verifies DB connectivity, creates logical snapshot in `data/backups/`, computes & verifies SHA-256 on disk, and preserves last known-good backup |
| `/api/v1/system/backups/verify` | `POST` | `ADMIN` | Verifies backup file existence, SHA-256 integrity, and structural restore readiness (`DRY_RUN_VERIFY` or `FULL_RESTORE` with explicit confirmation) |
| `/api/v1/system/updates/execute` | `POST` | `ADMIN` | Executes the 11-step controlled update state machine with automatic pre-update backup, post-update health checks, and automatic rollback on failure |
| `/api/v1/system/rollback` | `POST` | `ADMIN` | Reverts active version to last known-good version, requires confirmation if restoring DB backup, and verifies post-rollback health |
| `/api/v1/system/history` | `GET` | `ADMIN` | Paginated audit trail of all update, backup, restore, and rollback operations |

---

## 4. Operational UI (`System Updates, Offline Deployment & Recovery`)

Implemented in [`frontend/src/pages/backup/BackupUpdates.tsx`](../frontend/src/pages/backup/BackupUpdates.tsx):
- **Version & Health Status Tab**: Displays installed version, schema version, update state machine badge, last known-good baseline, post-update health checks, and architectural capability cards.
- **Controlled Update Manager Tab**: Interactive JSON manifest validator, SHA-256 & compatibility check summary, step-by-step update state machine progress viewer, and confirmation modal.
- **Database Backups & Verify Tab**: Lists all pre-update snapshots with SHA-256 hashes, `Known-Good` badges, and one-click **Verify Restore** readiness testing.
- **Rollback & Recovery Tab**: Displays rollback eligibility, target version, confirmation dialog with explicit data-loss warning acknowledgment when restoring database snapshots, and SOP recovery instructions.
- **Update Operation Log Tab**: Chronological audit table of all updates, backups, and rollbacks with operator identity and timestamps.

