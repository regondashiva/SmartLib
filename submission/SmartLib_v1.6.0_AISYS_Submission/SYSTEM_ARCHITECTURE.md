# SmartLib v1.6.0 — System Architecture

> **Official Submission Document**  
> **Master Reference:** [docs/SYSTEM_ARCHITECTURE.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/SYSTEM_ARCHITECTURE.md) and [docs/FINAL_SYSTEM_ARCHITECTURE.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/FINAL_SYSTEM_ARCHITECTURE.md)

## Multi-Tier Enterprise Architecture

SmartLib v1.6.0 implements a multi-tier, decoupled distributed architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TIER 1: WEB PRESENTATION LAYER                  │
│             React 18 + TypeScript + Vite + Tailwind CSS                │
│    - 22 Responsive Modules       - Role-Based Protected Routes         │
│    - Real-Time Status Telemetry  - Offline PWA Service Worker Ready    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / REST (JSON)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      TIER 2: CORE ILMS APPLICATION LAYER               │
│                  Node.js 22 LTS + Express + TypeScript                 │
│    - 15 Domain Services          - Zod Input Validation Middleware     │
│    - JWT Authentication Engine   - Granular 4-Tier RBAC Guards         │
│    - NCIP 2.0 / 3M SIP2 Adapters - Winston Structured Logging          │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ Prisma ORM (TLS 5432)          │ HTTP / REST
                    ▼                                ▼
┌───────────────────────────────────────┐ ┌──────────────────────────────┐
│       TIER 3: DATA PERSISTENCE        │ │ TIER 4: RFID EDGE MIDDLEWARE │
│       PostgreSQL 18.6 (Neon)          │ │ Python FastAPI + SQLite WAL  │
│  - 3NF Normalized Schema (18 Tables)  │ │ - Staff Station Pad Driver   │
│  - Trigram Full-Text Search Indices   │ │ - Dual-Pedestal Gate Driver  │
│  - Immutable Audit Logging            │ │ - Handheld Scanner Sweeps    │
└───────────────────────────────────────┘ └──────────────────────────────┘
```

Please refer to the full architectural breakdown, sequence diagrams, and protocol specifications in [docs/FINAL_SYSTEM_ARCHITECTURE.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/FINAL_SYSTEM_ARCHITECTURE.md).

