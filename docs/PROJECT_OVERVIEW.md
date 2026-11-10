# SmartLib v1.6.0 — Project Overview

**Document ID:** `SMARTLIB-PROJECT-OVERVIEW-v1.6.0`  
**System Name:** SmartLib Enterprise RFID-Enabled Integrated Library Management System  
**Version:** 1.6.0-AISYS-FINAL  
**Audit & Closure Date:** November 10, 2026  

---

## 1. Executive Summary

**SmartLib v1.6.0** is an enterprise-grade, RFID-enabled Integrated Library Management System (ILMS) engineered to solve high-density inventory reconciliation, circulation throughput bottlenecks, perimeter anti-theft security, and legacy data migration for university and institutional libraries.

Unlike traditional library software reliant on individual line-of-sight barcode scanning, SmartLib incorporates high-frequency/ultra-high-frequency (HF/UHF) RFID hardware integration, real-time Electronic Article Surveillance (EAS) security gates, handheld shelf-reading sweeps, and protocol interoperability (NCIP 2.0 and 3M SIP2) into a cohesive, auditable platform.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SMARTLIB v1.6.0 ECOSYSTEM                          │
├───────────────────────┬───────────────────────────┬─────────────────────────┤
│   FRONTEND PORTAL     │      CORE ILMS ENGINE     │     RFID MIDDLEWARE     │
│ React 18 + TypeScript │ Node.js Express TypeScript│ Python FastAPI 0.109+   │
│ Tailwind CSS + Vite   │ Prisma 5.22 + PostgreSQL  │ SQLite Offline WAL Queue│
│ 22 Unified Modules    │ 15 Enterprise Services    │ Mock Hardware Emulators │
└───────────────────────┴───────────────────────────┴─────────────────────────┘
```

---

## 2. Institutional Objectives & Core Capabilities

1. **Sub-Second Multi-Item Circulation**: Simultaneously issue, return, and renew physical items via RFID staff station readers, automatically arming/disarming the tag EAS security bit.
2. **Perimeter Loss Prevention**: Continuous security gate transit monitoring with audible/visual alarms on unauthorized items, entry/exit footfall telemetry, and synthetic CCTV snapshot correlation.
3. **Rapid Shelf Inventory Audits**: Ingest bulk EPC sweeps from mobile handheld scanners, instantly categorizing items as `VERIFIED`, `MISPLACED`, `MISSING`, or `UNCATALOGED`.
4. **20,000-Record Staged Migration**: Multi-format legacy data import (CSV, XLSX, MARC21-JSON) with column mapping, dry-run simulation, and transactional rollback protection.
5. **Provider-Neutral Notifications & Reports**: Asynchronous multi-channel messaging (Email, SMS, Print) with queue retry state machines, alongside 10 institutional reports with CSV/PDF exports.
6. **Zero-PII Public OPAC & Virtual Bookshelf**: Unauthenticated catalog search with PostgreSQL trigram ranking, external Net Cataloguing bibliographic lookup, and private patron reading lists.

---

## 3. Technology Stack & Architecture

- **Web Frontend**: React 18.3.1, TypeScript 5.6.2, Vite 5.4.11, Tailwind CSS 3.4.15, Lucide React icons.
- **Core Backend**: Node.js 22 LTS, Express 4.21.1, TypeScript 5.6.3, Prisma ORM 5.22.0, Zod schema validation, Winston structured logging.
- **Relational Database**: PostgreSQL 18.6 (Cloud Neon serverless instance with connection pooling).
- **RFID Middleware**: Python 3.12+, FastAPI, Uvicorn, SQLite 3 (local WAL offline event buffer), mock LLRP/Zebra driver emulators.
- **Standard Protocol Compliance**: NCIP 2.0 (NISO Z39.83-1-2012) and 3M SIP2 circulation boundaries.
- **Supply Chain Security**: CycloneDX 1.5 JSON Software Bill of Materials (`docs/sbom-cyclonedx-1.5.json`).

---

## 4. Key Performance & Verification Metrics

- **Total Application Modules**: **22** verified modules.
- **Automated Backend Tests**: **17 test suites, 129 test specifications** (100% pass in repeatability Runs 1 & 3; exit code 0).
- **Automated Frontend Tests**: **6 test suites, 27 test specifications** (100% pass; exit code 0).
- **Python Middleware Tests**: **21 test specifications** (100% pass; exit code 0).
- **Production Builds**: Backend (`tsc`) and Frontend (`tsc && vite build`) compile with **0 errors**.
- **Database Baseline**: Institutional baseline seed records (`users: 7, roles: 4, books >= 29, members >= 8`) 100% preserved.

---

## 5. AISYS Submission Documentation Set

| Document | Purpose |
| :--- | :--- |
| [`FINAL_AISYS_REQUIREMENT_TRACEABILITY_MATRIX.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/FINAL_AISYS_REQUIREMENT_TRACEABILITY_MATRIX.md) | Bidirectional mapping for FR01–FR12, NFR01–NFR09, AC01–AC10, D1–D9 |
| [`FINAL_SYSTEM_MODULE_DOCUMENTATION.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/FINAL_SYSTEM_MODULE_DOCUMENTATION.md) | Detailed documentation of all 22 application modules |
| [`SYSTEM_ARCHITECTURE.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/SYSTEM_ARCHITECTURE.md) | Multi-tier architectural design and sequence diagrams |
| [`DATABASE_DESIGN.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/DATABASE_DESIGN.md) | 3NF relational schema, entity relationships, and constraints |
| [`API_DOCUMENTATION.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/API_DOCUMENTATION.md) | REST API endpoints, request/response contracts, and error envelopes |
| [`RFID_MIDDLEWARE_DOCUMENTATION.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/RFID_MIDDLEWARE_DOCUMENTATION.md) | Hardware abstraction layer, SQLite offline queue, and driver specs |
| [`SECURITY_AND_RBAC.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/SECURITY_AND_RBAC.md) | JWT auth, 4-tier RBAC matrix, and security audit results |
| [`INSTALLATION_AND_DEPLOYMENT_GUIDE.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/INSTALLATION_AND_DEPLOYMENT_GUIDE.md) | Production setup, local installation, and demo startup guide |
| [`USER_MANUAL.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/USER_MANUAL.md) | Operational guidelines for Admin, Librarian, and RFID staff |
| [`TESTING_AND_VERIFICATION_REPORT.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/TESTING_AND_VERIFICATION_REPORT.md) | Multi-suite test results, repeatability evidence, and logs |
| [`BACKUP_AND_RECOVERY_GUIDE.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/BACKUP_AND_RECOVERY_GUIDE.md) | SQL backup, SHA-256 verification, and isolated schema restore |
| [`KNOWN_LIMITATIONS.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/KNOWN_LIMITATIONS.md) | Full honest disclosure of mock adapters and cloud limitations |

