# SmartLib v1.6.0 — Project Overview

> **Official Submission Document**  
> **Master Reference:** [docs/PROJECT_OVERVIEW.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/PROJECT_OVERVIEW.md)

## Executive Summary
SmartLib v1.6.0 is an enterprise-grade, RFID-enabled Integrated Library Management System (ILMS) designed for academic institutions, research centers, and university libraries. It unifies high-frequency/ultra-high-frequency (HF/UHF) RFID hardware integration, real-time security gate transit monitoring, automated self-service circulation boundaries, precision shelf inventory, and robust legacy data migration into a cohesive, secure, and auditable platform.

### Core Architecture Overview
- **Web Frontend**: React 18.3.1 + TypeScript + Tailwind CSS + Vite (22 unified modules).
- **Core Backend**: Node.js 22 LTS + Express + TypeScript + Prisma ORM 5.22.0.
- **Relational Database**: PostgreSQL 18.6 (Cloud Neon Serverless Instance).
- **RFID Edge Middleware**: Python 3.12+ + FastAPI + Uvicorn + SQLite 3 local offline WAL event buffer.
- **Protocol Standards**: NCIP 2.0 (NISO Z39.83-1-2012) and 3M SIP2 circulation boundaries.
- **Software Bill of Materials**: CycloneDX 1.5 JSON standard (`docs/sbom-cyclonedx-1.5.json`).

Please refer to the complete technical overview in [docs/PROJECT_OVERVIEW.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/PROJECT_OVERVIEW.md).

