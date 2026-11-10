# SmartLib — Final System Architecture (v1.5.0)

## 1. Architectural Overview

SmartLib is an enterprise-grade, RFID-enabled Integrated Library Management System (ILMS) engineered across four runtime tiers:

1. **Presentation Layer (`frontend/`):** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, and Lucide UI components providing role-aware workspaces for Administrators, Librarians, and RFID Operators.
2. **Core Application & Policy Engine (`backend/`):** Node.js 20, Express, TypeScript, Zod validation, and Prisma ORM implementing RBAC, cataloguing, circulation, fine calculation, 20,000-record data migration, institutional reporting, dynamic policy configuration, and backup/update/rollback lifecycle controls.
3. **Hardware Abstraction & Offline Event Middleware (`rfid-service/`):** Python 3.11+ FastAPI microservice managing HF/UHF RFID reader adapters (Staff Station, Handheld Reader, Dual-Pedestal Security Gate), EAS bit validation, CCTV correlation markers, and a local SQLite WAL offline event buffer (`event_buffer.db`).
4. **Transactional Data Layer (`Neon PostgreSQL`):** Serverless PostgreSQL 16 storing 21 normalized relational tables with strict foreign-key constraints, composite indexes, and immutable audit trails.

---

## 2. High-Level Topology

```
+-----------------------------------------------------------------------------------+
|                        React 18 + TypeScript SPA (Port 5173)                      |
|  Cataloguing | Circulation | 20k Migration | Reports | Settings | Backup/Updates  |
+-----------------------------------------+-----------------------------------------+
                                          |
                        HTTPS / REST JSON | JWT Bearer + RBAC
                                          v
+-----------------------------------------------------------------------------------+
|                     Node.js Express Backend API (Port 4000)                       |
|  /auth  /books  /members  /circulation  /fines  /rfid  /migrations  /reports      |
|  /settings (Dynamic Policy Engine)      /system (Backups, Updates & Rollback)     |
+--------------------+-----------------------------------------+--------------------+
                     |                                         ^
   Prisma ORM (TLS)  |                                         | Service JWT + Retry
                     v                                         |
+----------------------------------------+   +-----------------+--------------------+
|     Neon Serverless PostgreSQL 16      |   | Python FastAPI RFID Service (:8001)  |
|  - 21 Normalized Relational Tables     |   |  - Reader Adapter Layer (Mock/Live)  |
|  - ACID Transactions & Row Locking     |   |  - EAS Validation & Gate Telemetry   |
|  - AuditLog & SystemConfiguration      |   |  - SQLite WAL Offline Queue (buffer) |
+----------------------------------------+   +--------------------------------------+
```

---

## 3. Core Subsystems & Responsibilities

| Subsystem | Source Location | Primary Responsibilities |
|---|---|---|
| **Authentication & RBAC** | `backend/src/modules/auth/`, `backend/src/middleware/` | Bcrypt password verification, JWT issuance, sliding-window rate limiting, and role enforcement (`ADMIN`, `LIBRARIAN`, `RFID_OPERATOR`). |
| **Bibliographic Cataloguing & Copies** | `backend/src/modules/books/` | MARC-compatible bibliographic records (`Book`, `Author`, `Publisher`, `Category`) separated from physical copy inventory (`BookItem`, `RFIDTag`). |
| **Circulation & Fine Ledger** | `backend/src/modules/circulation/`, `backend/src/modules/fines/` | Atomic checkout, renewal, return, dynamic overdue fine calculation, partial/full fine payment, fine waiver with audit reason, and automatic EAS bit arm/disarm. |
| **Enterprise Data Migration (20k)** | `backend/src/modules/migrations/` | Multi-format ingestion (CSV, XLSX, MARC21-JSON), field mapping, staging table validation, duplicate ISBN/accession/barcode detection, dry-run preview, batched transactional commit, and safe batch rollback. |
| **RFID Hardware & Inventory Engine** | `backend/src/modules/rfid/`, `rfid-service/` | Tag encoding/binding (`POST /api/v1/rfid/tags`), handheld shelf reconciliation (`POST /api/v1/rfid/inventory-sessions`), security gate passage/alarm logging (`POST /api/v1/rfid/gate-events`), and SQLite offline event buffering. |
| **Reports & Analytics** | `backend/src/modules/reports/` | Live SQL aggregations across 9 institutional report domains with date/category filtering, role-based PII masking, CSV streaming, and PDF generation. |
| **Institutional Policy Configuration** | `backend/src/modules/settings/` | Dynamic database-backed policies across 5 categories (`circulation`, `rfid`, `securityGate`, `notifications`, `institutional`) with audit history. |
| **Offline Deployment, Backup & Recovery** | `backend/src/modules/system/`, `deploy/offline-package/` | Logical database snapshots with SHA-256 checksum verification, isolated dry-run restore testing, version manifest validation, controlled updates, and automatic rollback on failure. |

---

## 4. Database Architecture Summary

- **Identity & Access:** `User`, `Role`, `Permission`, `RolePermission`
- **Patron Management:** `Member`, `Notification`, `HoldReservation`
- **Catalog & Inventory:** `Book`, `Author`, `BookAuthor`, `Publisher`, `Category`, `BookItem`, `RFIDTag`
- **Hardware & Security Telemetry:** `RFIDDevice`, `DeviceEvent`, `GateEvent`, `InventorySession`, `InventoryScan`
- **Circulation & Financials:** `Circulation`, `Fine`
- **Migration & Governance:** `MigrationBatch`, `MigrationStagingRecord`, `AuditLog`, `SystemConfiguration`

