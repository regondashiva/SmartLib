# SmartLib Phase 4F — Offline Installation & Deployment Guide

## 1. Scope & Architectural Boundary

SmartLib supports **offline package installation and controlled updates** using locally staged bundles and runtimes without requiring internet access during installation.

> [!IMPORTANT]
> **Distinction Between RFID Offline Event Buffering and Primary Database Operations**
> - **RFID SQLite Offline Buffer (`rfid-service/data/offline_events.db`)**: Buffers security gate passages and RFID tag scans locally on the edge station when the backend API or network is unreachable, and automatically synchronizes them in FIFO order upon reconnection.
> - **Primary PostgreSQL Database (`DATABASE_URL`)**: Full catalog, member management, circulation (checkout/renewal/return), and fine transactions require network connectivity to the configured PostgreSQL 15+ / Neon Serverless PostgreSQL endpoint. SmartLib does not silently substitute a local database for primary library circulation.

---

## 2. System Prerequisites

### Windows 11 Client / Workstation & Windows Server 2022+
| Component | Minimum Version | Purpose |
|---|---|---|
| **Operating System** | Windows 11 Pro/Enterprise (64-bit) or Windows Server 2022+ | Host OS for Backend, Frontend static server/IIS, and RFID Middleware |
| **Node.js Runtime** | `>= v20.0.0 LTS` | Executes the Express/Prisma Backend Engine |
| **Python Runtime** | `>= v3.11.0` | Executes the FastAPI RFID Middleware & SQLite buffer |
| **PostgreSQL Endpoint** | `>= 15.0` (Neon PostgreSQL or institutional PostgreSQL server) | Primary relational database |
| **Disk Space** | `>= 500 MB` free (2 GB+ recommended) | Application bundles, pre-update database backups (`data/backups/`), and SQLite WAL journal |

---

## 3. Offline Installation Procedure

### Step 1: Verify Package Manifest & Prerequisites
Open an elevated PowerShell terminal in the repository root and run the offline installer validator:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\offline-package\scripts\install-offline.ps1 -DryRun
```

The script verifies:
1. Presence and structural validity of `deploy/offline-package/version-manifest.json`.
2. Installed Node.js version (`>= 20.0.0`).
3. Installed Python version (`>= 3.11.0`).
4. Available disk space (`>= 500 MB`).
5. Presence of compiled production frontend assets (`frontend/dist/index.html`).

### Step 2: Configure Environment Files (Secrets Kept Outside Package)
Copy the provided templates and supply institutional credentials:

```powershell
Copy-Item .\deploy\offline-package\env-templates\backend.env.example .\backend\.env
Copy-Item .\deploy\offline-package\env-templates\frontend.env.example .\frontend\.env.production
Copy-Item .\deploy\offline-package\env-templates\rfid-service.env.example .\rfid-service\.env
```

Edit `backend/.env` and configure:
- `DATABASE_URL` — PostgreSQL connection string.
- `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET` — Cryptographically strong 64-character hex secrets.

### Step 3: Verify Database Schema & Start Services
1. Validate Prisma client and database connectivity:
   ```powershell
   npm --prefix backend run prisma:validate
   ```
2. Start Backend Engine (Port `5000`):
   ```powershell
   npm --prefix backend run start
   ```
3. Start RFID Middleware (Port `8001`):
   ```powershell
   cd rfid-service
   uvicorn main:app --host 0.0.0.0 --port 8001
   ```
4. Verify system health:
   - `GET http://localhost:5000/api/v1/health` → `status: "HEALTHY"`

---

## 4. Troubleshooting Common Installation Issues

| Symptom / Error Message | Cause | Resolution |
|---|---|---|
| `[FATAL] Node.js v18.x is below minimum required version v20.0.0` | Outdated host Node.js runtime | Install Node.js 20 LTS (`node-v20.x-x64.msi`) from local installation media and restart PowerShell. |
| `[FATAL] Insufficient disk space on drive C:` | Less than 500 MB free space | Free disk space on the target volume before running installation or update. |
| `status: "DEGRADED"` on `/api/v1/health` | `DATABASE_URL` unreachable or firewall blocking port `5432` | Verify `DATABASE_URL` in `backend/.env` and confirm outbound TCP `5432` connectivity to Neon / PostgreSQL host. |

