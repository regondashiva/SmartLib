# SmartLib v1.6.0 — Final Offline Deployment Capabilities & Limitations

**Document ID:** `FINAL-OFFLINE-LIMITATIONS-v1.6.0`  
**Audit Date:** November 9, 2026  
**Verification Status:** **PARTIAL OFFLINE VERIFICATION (Local Artifact Staging & RFID SQLite Queue Verified Offline; Full Air-Gapped Stack Execution Blocked by Missing Host PostgreSQL Daemon)**

---

## 1. Strict Distinction: Offline Package Staging vs. Complete Air-Gapped Deployment

In accordance with AISYS audit standards, **offline package staging** and **RFID edge event buffering** must not be conflated with **complete air-gapped operation of the entire SmartLib stack**:

| Deployment Aspect | What Was Executed & Verified | Internet Required During Test? | Full Air-Gapped Status |
|---|---|---|---|
| **1. Offline Package Prerequisite Validation & Artifact Staging (`install-offline.ps1`)** | Executed `powershell -ExecutionPolicy Bypass -File "deploy/offline-package/scripts/install-offline.ps1" -TargetDir "data/isolated-offline-install-5b"` (with `dryRun = false`). Verified local OS (`Windows 11 Home Single Language`), Node.js `v22.14.0`, Python `v3.12.4`, disk space, and copied compiled `frontend/dist`, `backend/dist`, `backend/prisma/schema.prisma`, and `rfid-service/` into `data/isolated-offline-install-5b/`. | **No (100% Local Filesystem)** | **Verified Offline** |
| **2. Artifact SHA-256 Receipt Verification** | Generated and verified `data/isolated-offline-install-5b/installation-receipt.json` (`frontendIndexHtml`: `ce2d6bd0...`, `backendAppJs`: `b1cfd15d...`, `prismaSchema`: `ede0d664...`). | **No (100% Local Filesystem)** | **Verified Offline** |
| **3. Python FastAPI RFID Middleware & Local SQLite Event Queue (`rfid-service/`)** | Tested offline gate/scan event buffering in local SQLite (`rfid-service/data/offline_events.db`) when the backend is unreachable, including duplicate event rejection (`UNIQUE(event_id)`), hardware timestamp preservation, and FIFO replay. | **No (100% Local SQLite WAL)** | **Verified Offline** |
| **4. Controlled Update & Rollback Lifecycle (`/api/v1/system/updates/execute`, `/api/v1/system/rollback`)** | Verified 11-step update state machine, pre-update snapshot verification, automatic rollback on simulated health-check failure, and manual rollback. | **Yes (Connected to Neon PostgreSQL)** | **Requires PostgreSQL Connection** |
| **5. Full Stack Execution (Frontend + Backend + RFID Middleware + Local PostgreSQL) in Disconnected Environment** | **NOT EXECUTED** in a network-disconnected air-gapped environment because the evaluation host lacks a running local PostgreSQL server binary (`postgres.exe`) or Docker engine, requiring the Express backend to connect to Neon Serverless PostgreSQL over TLS. | **Yes (Backend DB uses Neon TLS)** | **Not Verified Air-Gapped (Host Prerequisite Missing)** |

---

## 2. Host Inspection Evidence & Local PostgreSQL Prerequisite

Inspection of the Windows 11 evaluation machine (`Microsoft Windows 11 Home Single Language`) confirmed:
1. `C:\Program Files\PostgreSQL\18` contains only the leftover `data\` directory (`PG_VERSION = 18`) from a prior uninstallation; `C:\Program Files\PostgreSQL\18\bin\postgres.exe`, `pg_dump.exe`, and `psql.exe` are **not present** on disk, and no Windows PostgreSQL service is registered.
2. `C:\windows\system32\docker` is a 0-byte stub (`Version 0.0.0.0`) with no Docker Desktop daemon installed.
3. Consequently, `install-offline.ps1` explicitly recorded in `data/isolated-offline-install-5b/installation-receipt.json`:
   ```json
   "postgresHostState": "DATA_DIR_ONLY_NO_LOCAL_DAEMON (Requires external/isolated PostgreSQL endpoint)"
   ```

---

## 3. Prerequisites Required for True Air-Gapped Operation on Windows 11 / Windows Server 2022+

To operate the complete SmartLib stack (Frontend + Backend + RFID Middleware + Database) in a zero-internet air-gapped environment:
1. **Install Local PostgreSQL 16/17 Server MSI:** Install the official offline Windows x64 PostgreSQL 16 or 17 installer (`postgresql-16.x-windows-x64.exe`) on the target Windows 11 workstation or Windows Server 2022+ host so that `postgres.exe`, `pg_dump.exe`, and `psql.exe` run as a local Windows service on `127.0.0.1:5432`.
2. **Point `DATABASE_URL` and `DIRECT_URL` to Localhost:** Update `backend/.env` from the Neon cloud connection string to `postgresql://postgres:<password>@127.0.0.1:5432/smartlib?schema=public`.
3. **Apply Local Prisma Migrations:** Run `npx prisma migrate deploy` (or execute the bundled SQL schema DDL) against `127.0.0.1:5432`.

