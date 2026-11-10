# SmartLib — Final Deployment Guide (Windows 11 & Windows Server 2022+)

**System Version:** `1.5.0`  

---

## 1. Prerequisites & System Requirements

| Component | Minimum Requirement | Recommended Production Spec |
|---|---|---|
| **Operating System** | Windows 11 Pro (64-bit) | Windows Server 2022 Standard / Datacenter (64-bit) |
| **CPU & RAM** | 4 vCPU, 8 GB RAM | 8 vCPU, 16 GB RAM |
| **Disk Space** | 2 GB free disk space | 20 GB SSD (for backups, logs, and SQLite buffer) |
| **Node.js Runtime** | Node.js `v20.0.0+` LTS | Node.js `v20.x` or `v22.x` LTS |
| **Python Runtime** | Python `3.11+` | Python `3.11` or `3.12` (with `venv`) |
| **Database** | Neon Serverless PostgreSQL 16 (TLS 5432) | Neon PostgreSQL 16 or On-Premise PostgreSQL 16 |

---

## 2. Environment Configuration

Copy the environment templates from `deploy/offline-package/env-templates/` to their respective service directories and populate your institutional secrets:

1. **Backend (`backend/.env`):**
   - `PORT=4000`
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://<user>:<password>@<neon-host>/<dbname>?sslmode=require`
   - `DIRECT_URL=postgresql://<user>:<password>@<neon-host>/<dbname>?sslmode=require`
   - `JWT_ACCESS_SECRET=<cryptographically-random-64-char-secret>`
   - `JWT_REFRESH_SECRET=<cryptographically-random-64-char-secret>`
   - `MOCK_RFID_MODE=true` *(set `false` only after physical reader SDK binding)*
   - `RFID_MIDDLEWARE_URL=http://localhost:8001`
2. **Frontend (`frontend/.env`):**
   - `VITE_API_BASE_URL=http://localhost:4000/api/v1`
   - `VITE_RFID_SERVICE_URL=http://localhost:8001`
3. **RFID Middleware (`rfid-service/.env`):**
   - `RFID_SERVICE_PORT=8001`
   - `MOCK_RFID_MODE=true`
   - `BACKEND_API_URL=http://localhost:4000/api/v1`
   - `SQLITE_BUFFER_PATH=./event_buffer.db`

---

## 3. Standard Build & Startup Procedure

```powershell
# 1. Validate & Generate Prisma Client
npm --prefix backend run prisma:generate

# 2. Build Backend & Frontend Production Bundles
npm --prefix backend run build
npm --prefix frontend run build

# 3. Start Backend Server (Port 4000)
npm --prefix backend run start

# 4. Start Python FastAPI RFID Middleware (Port 8001)
cd rfid-service
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

---

## 4. Offline Package Installation, Update & Rollback

SmartLib provides automated PowerShell deployment scripts in `deploy/offline-package/scripts/`:

```powershell
# Pre-flight dry-run validation (checks OS, Node, Python, disk space, and manifest SHA-256)
powershell -ExecutionPolicy Bypass -File .\deploy\offline-package\scripts\install-offline.ps1 -DryRun

# Execute offline installation
powershell -ExecutionPolicy Bypass -File .\deploy\offline-package\scripts\install-offline.ps1

# Execute controlled update (creates mandatory pre-update backup first)
powershell -ExecutionPolicy Bypass -File .\deploy\offline-package\scripts\update-smartlib.ps1

# Emergency rollback to last known-good version
powershell -ExecutionPolicy Bypass -File .\deploy\offline-package\scripts\rollback-smartlib.ps1
```

