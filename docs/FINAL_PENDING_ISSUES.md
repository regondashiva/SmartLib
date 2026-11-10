# SmartLib v1.6.0 — Final Pending Issues & Recommended Backlog

**Audit Date:** November 10, 2026  
**Auditor:** AISYS Independent Technical Audit  
**Status Notice:** *In accordance with audit directives, no code modifications have been made without prior explicit authorization.*

---

## 1. Discovered Issues & Technical Backlog

| Issue ID | Module / File Location | Problem Description | Impact | Recommended Correction | Priority |
|---|---|---|---|---|---|
| **ISSUE-01** | Workstation Git Root (`.git`) | Running `git rev-parse` resolves to `C:/Users/shiva` (Windows user profile) instead of the project root directory. | Risk of accidentally staging user profile files (`NTUSER.DAT`, `.bash_history`) when pushing to remote Git. | Initialize a fresh git repository directly inside `smartLib/` (`git init`) prior to pushing to GitHub. | **HIGH** |
| **ISSUE-02** | Root Directory (`README.md`) | Workspace root does not currently contain a top-level `README.md` (detailed documentation resides in `rfid-service/README.md` and `docs/`). | Evaluators viewing the repository root lack immediate entry-point orientation. | Create a root `README.md` linking to quick-start commands, default credentials, and `docs/` deliverables. | **MEDIUM** |
| **ISSUE-03** | Backend Tests (`phase4c-migration.test.ts`, `phase4.test.ts`) | Tests use static hardcoded ISBNs (`9780137081073`, `9780201485677`) that already persist in the shared database. | Concurrent/parallel test executions fail with 409 Conflict; tests only pass cleanly when run in isolation. | Refactor static ISBN test fixtures to dynamic timestamp suffixes (e.g., ``9780${Date.now().toString().slice(-9)}``). | **MEDIUM** |
| **ISSUE-04** | Offline Packaging (`docker-compose.offline.yml`) | Compose file orchestrates backend, frontend, and RFID containers, but assumes an external or host-installed database. | Air-gapped single-command Docker deployment requires an already-running PostgreSQL server. | Add a containerized `postgres:16-alpine` service with a pre-seeded volume to `docker-compose.offline.yml`. | **MEDIUM** |
| **ISSUE-05** | Frontend Stat Cards (`Dashboard.tsx`, `Members.tsx`) | Month-over-month trend percentages (e.g. `+4.2% vs last month`) display fixed decorative strings. | Cosmetic; actual numbers are 100% real API data, but trends are not dynamically calculated from historical snapshots. | Compute deltas from historical monthly registration logs or hide the trend indicator when historical snapshots are absent. | **LOW** |

---

## 2. Recommendation on Implementation

None of the above issues block functional demonstration or AISYS milestone grading:
- The live system compiles with zero build errors.
- Every API route and UI screen functions end-to-end.
- Role-based access control, RFID middleware emulation, and SQLite event buffering are verified.
- The project is ready for submission as **`READY WITH DOCUMENTED LIMITATIONS`**.

