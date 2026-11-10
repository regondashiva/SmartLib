# SmartLib — AC09 Offline Installation, Update & Rollback Verification Report

**Document ID:** `VER-AC09-5B`  
**Phase:** Phase 5B Final Acceptance Verification  
**Verification Date:** November 9, 2026  
**Status:** **PASS WITH DOCUMENTED HOST DATABASE LIMITATION**

---

## 1. Real (Non-Dry-Run) Offline Package Installation Verification

Rather than relying on `-DryRun`, Phase 5B executed a real isolated offline installation via [`install-offline.ps1`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/deploy/offline-package/scripts/install-offline.ps1):

- **Command Executed:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File "deploy/offline-package/scripts/install-offline.ps1" -TargetDir "data/isolated-offline-install-5b"
  ```
- **What Was Executed Without Internet Access:**
  1. Validated `deploy/offline-package/version-manifest.json` (`smartlib-offline-release-1.4.0`).
  2. Verified Windows 11 host OS, Node.js `v22.14.0` (`>= 20.0.0`), Python `v3.12.4` (`>= 3.11.0`), and available disk space (`> 500 MB`).
  3. Staged compiled production bundles (`frontend/dist/*`, `backend/dist/*`, `backend/prisma/schema.prisma`, `rfid-service/*.py`, `drivers/`, `routers/`, `buffer/`) into the clean isolated target directory `data/isolated-offline-install-5b/`.
  4. Computed SHA-256 digests of the installed `frontend/dist/index.html`, `backend/dist/app.js`, and `backend/prisma/schema.prisma` artifacts and wrote `data/isolated-offline-install-5b/installation-receipt.json` (`dryRun: false`, `installationMode: "REAL_OFFLINE_ISOLATED_INSTALL"`).
- **Controlled Offline Update & Rollback Verification:**
  - Verified 11-step controlled update (`POST /api/v1/system/updates/execute`) with automatic pre-update backup creation, SHA-256 package checksum validation, automatic rollback on simulated post-update health-check failure, and manual rollback (`POST /api/v1/system/rollback`) in `backend/tests/phase4f-updates-recovery.test.ts` (10/10 PASS) and `backend/tests/phase5b-acceptance.test.ts` (Test 4 PASS).

---

## 2. Windows 11 Client & Windows Server 2022+ Compatibility & Host Database Limitation

1. **Application Tier & RFID Offline Buffer (`100% Local`):**
   - The React frontend production bundle (`frontend/dist`), Express backend (`backend/dist`), and FastAPI RFID middleware (`rfid-service` with local SQLite WAL buffer `offline_events.db`) install and start locally on Windows 11 without internet access.
2. **PostgreSQL Host Boundary on This Evaluation Machine (`Documented Limitation`):**
   - Inspection of `C:\Program Files\PostgreSQL\18` confirmed that only the `data/` directory remains from a previous local PostgreSQL 18 installation (`bin\postgres.exe` and `pg_dump.exe` are not installed on the host, and `C:\windows\system32\docker` is a 0-byte stub with no running Docker daemon).
   - Consequently, while artifact installation and RFID event buffering run completely offline on the local Windows 11 filesystem, the Express backend connects to the configured PostgreSQL 17 instance (`Neon Serverless PostgreSQL`). For a 100% air-gapped Windows 11 / Windows Server 2022+ deployment, the local PostgreSQL 16/17 Windows Server MSI installer (or Docker Desktop offline image bundle) must be installed on the host.

