# SmartLib v1.6.0 — AISYS Official Project Submission Package

**Project Name:** SmartLib — RFID-Enabled Integrated Library Management System  
**Version:** 1.6.0-AISYS-FINAL  
**Submission Date:** November 10, 2026  
**Evaluation Standard:** AISYS Candidate Software Development SOP  
**Overall Decision:** **`STABILIZED & READY WITH DOCUMENTED LIMITATIONS`**  

---

## 1. Submission Overview

This submission package consolidates all evaluation artifacts, technical architecture, requirement traceability matrices, test evidence, operational runbooks, user manuals, and limitation disclosures for **SmartLib v1.6.0**.

SmartLib is an enterprise-grade library management system unifying React 18, Node.js Express, PostgreSQL, and Python FastAPI RFID edge middleware into an auditable, high-throughput platform.

---

## 2. Submission Artifact Index

| Submission Document | Target Link / Primary Reference | Description |
| :--- | :--- | :--- |
| **Project Overview** | [`PROJECT_OVERVIEW.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/PROJECT_OVERVIEW.md) | System background, objectives, and technology stack. |
| **System Architecture** | [`SYSTEM_ARCHITECTURE.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/SYSTEM_ARCHITECTURE.md) | Multi-tier topology, component boundaries, and sequence diagrams. |
| **Traceability Matrix** | [`REQUIREMENT_TRACEABILITY_MATRIX.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/REQUIREMENT_TRACEABILITY_MATRIX.md) | Full bidirectional mapping of FR01–FR12, NFR01–NFR09, AC01–AC10, D1–D9, D0–D10. |
| **Module Documentation** | [`MODULE_DOCUMENTATION.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/MODULE_DOCUMENTATION.md) | Comprehensive functional specification for all 22 application modules. |
| **Database Design** | [`DATABASE_DESIGN.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/DATABASE_DESIGN.md) | 3NF relational schema, entity relationships, and index definitions. |
| **API Documentation** | [`API_DOCUMENTATION.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/API_DOCUMENTATION.md) | REST API endpoints, parameters, request/response contracts. |
| **Installation Guide** | [`INSTALLATION_GUIDE.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/INSTALLATION_GUIDE.md) | Prerequisites, environment setup, database migrations, and service startup. |
| **User Manual** | [`USER_MANUAL.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/USER_MANUAL.md) | Operational guidelines for Admin, Librarian, RFID Operator, and Patron personas. |
| **Testing & Verification** | [`TESTING_AND_VERIFICATION_REPORT.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/TESTING_AND_VERIFICATION_REPORT.md) | 3-run repeatability matrix, test breakdowns, and build verifications. |
| **Backup & Recovery** | [`BACKUP_AND_RECOVERY_GUIDE.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/BACKUP_AND_RECOVERY_GUIDE.md) | SQL backup procedures, SHA-256 verification, and isolated schema restore. |
| **Known Limitations** | [`KNOWN_LIMITATIONS.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/KNOWN_LIMITATIONS.md) | Transparent disclosure of mock adapters, cloud latency, and air-gapped prerequisites. |
| **Demonstration Guide** | [`DEMONSTRATION_GUIDE.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/DEMONSTRATION_GUIDE.md) | Step-by-step 10–15 minute evaluation walkthrough across 12 stages. |
| **Evidence Index** | [`EVIDENCE_INDEX.md`](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/EVIDENCE_INDEX.md) | Catalog of genuine screenshots and execution log files. |

---

## 3. Evidence Subdirectories

- **`screenshots/`**: Contains 16 genuine user-captured screenshots from live application runs at `http://localhost:5173`.
- **`test-logs/`**: Contains raw console execution logs from three full backend repeatability runs (`backend-test-run-1.log`, `backend-test-run-2.log`, `backend-test-run-3.log`) and the repeatability summary log.

---

## 4. Evaluator Quick Start

```powershell
# 1. Start Core Backend (Port 5000)
cd backend
npm run dev

# 2. Start RFID Middleware (Port 8000)
cd ../rfid-service
.\venv\Scripts\activate
uvicorn main:app --port 8000 --reload

# 3. Start Frontend Portal (Port 5173)
cd ../frontend
npm run dev
```

- Open browser to `http://localhost:5173/login`.
- Click **Admin Demo** (or use `admin@smartlib.ac.in` / `Admin@123456`).
- Follow the [Demonstration Guide](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/submission/SmartLib_v1.6.0_AISYS_Submission/DEMONSTRATION_GUIDE.md).

