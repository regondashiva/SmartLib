# SmartLib v1.6.0 — Installation & Deployment Guide

**Document ID:** `SMARTLIB-INSTALLATION-DEPLOYMENT-GUIDE-v1.6.0`  
**Application:** SmartLib RFID-Enabled Integrated Library Management System  
**Audit & Closure Date:** November 10, 2026  

---

## 1. System Prerequisites

Before installing SmartLib v1.6.0, ensure the host system satisfies the following software prerequisites:

| Component | Minimum Version | Recommended Version | Verification Command |
| :--- | :--- | :--- | :--- |
| **Operating System** | Windows 10 / Ubuntu 22.04 LTS | Windows 11 / Windows Server 2022 | `[System.Environment]::OSVersion` |
| **Node.js** | `v20.x LTS` | `v22.x LTS` | `node -v` |
| **npm** | `v10.x` | `v10.9.x` | `npm -v` |
| **Python** | `3.10` | `3.12+` | `python --version` |
| **PostgreSQL** | `15.x` | `16.x` or Neon PostgreSQL 18.6 | `psql --version` |
| **Git** | `2.30+` | `2.45+` | `git --version` |

---

## 2. Environment Configuration

### 2.1 Backend Environment Setup (`backend/.env`)

Copy the example template and supply your PostgreSQL connection string:

```bash
cd backend
cp .env.example .env
```

**Required Environment Variables:**
```env
# Application Port
PORT=5000
NODE_ENV=development

# Database Connection (Neon PostgreSQL or Local PostgreSQL)
DATABASE_URL="postgresql://[username]:[password]@[host]/[database]?sslmode=require"
DIRECT_URL="postgresql://[username]:[password]@[host]/[database]?sslmode=require"

# JWT Authentication Secret (Minimum 32 characters)
JWT_SECRET="smartlib-enterprise-production-super-secret-jwt-key-32-chars-min"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# RFID Edge Middleware URL
RFID_SERVICE_URL="http://127.0.0.1:8000"
```

### 2.2 Frontend Environment Setup (`frontend/.env`)

```bash
cd ../frontend
cp .env.example .env
```

```env
VITE_API_URL="http://localhost:5000/api/v1"
```

---

## 3. Step-by-Step Installation

### Step 1: Install Backend Dependencies & Apply Migrations

```bash
# Navigate to backend directory
cd backend

# Install npm dependencies
npm install

# Validate and apply Prisma database migrations
npx prisma db push

# (Optional) Seed initial institutional accounts and catalog
npm run seed
```

### Step 2: Install Frontend Dependencies & Build

```bash
# Navigate to frontend directory
cd ../frontend

# Install npm dependencies
npm install

# Build production bundle
npm run build
```

### Step 3: Setup Python RFID Edge Middleware

```bash
# Navigate to rfid-service directory
cd ../rfid-service

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

---

## 4. Starting the Services

For a complete local development or demonstration environment, launch the three components in separate terminal windows:

### Terminal 1: Core ILMS Backend (Port 5000)
```bash
cd backend
npm run dev
# Server starts at http://localhost:5000
# Health check: http://localhost:5000/api/v1/health
```

### Terminal 2: RFID Edge Middleware (Port 8000)
```bash
cd rfid-service
# Activate venv
.\venv\Scripts\activate
# Start Uvicorn ASGI server
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
# Middleware health: http://127.0.0.1:8000/health
```

### Terminal 3: React Web Frontend (Port 5173)
```bash
cd frontend
npm run dev
# Web application starts at http://localhost:5173
```

---

## 5. Offline Package Deployment (Air-Gapped Workflow)

For air-gapped institutions without continuous internet connectivity:

1. **Package Location**: `deploy/offline-package/`
2. **Execution Script**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File deploy/offline-package/scripts/install-offline.ps1
   ```
3. **Verification**:
   The installer validates the SHA-256 receipts of pre-bundled frontend assets, backend JavaScript bundles, and Prisma schema definitions (`installation-receipt.json`).
4. **Offline Prerequisite**: PostgreSQL server must be pre-installed on the host machine before executing air-gapped deployment.

