# SmartLib v1.6.0 — Screenshot & Evidence Index

**Document ID:** `SMARTLIB-EVIDENCE-INDEX-v1.6.0`  
**Application:** SmartLib RFID-Enabled Integrated Library Management System  
**Audit & Closure Date:** November 10, 2026  

---

## 1. Genuine UI Screenshot Directory (`docs/evidence/screenshots/`)

All screenshots indexed below were genuinely captured from the live application running at `http://localhost:5173`:

| # | System Module | Route | Screenshot Filename | Verified UI Elements |
| :---: | :--- | :--- | :--- | :--- |
| 1 | **Landing Page** | `/` | *Manual capture checklist provided in Section 2* | Institutional hero, OPAC button, Staff Login button |
| 2 | **Login Page** | `/login` | `media_1793977478524_5c4d8d2e.jpg` | Institutional logo, credentials form, quick demo fill buttons |
| 3 | **Dashboard** | `/` | `uploaded_media_1793989510189.jpg` | 8 KPI stat cards, circulation trends, category breakdown |
| 4 | **Book Catalog** | `/books` | `media_1794247723018_3788fc5b.jpg` | Catalog title cards, filter toolbar, copy breakdown, status badges |
| 5 | **Cataloguing** | `/cataloguing` | *Manual capture checklist provided in Section 2* | Bibliographic form, ISBN validator, accession sequencer |
| 6 | **Acquisition Management** | `/acquisitions` | `media_1794247741837_501eb552.jpg` | Supplier POs, order quantities, receiving-to-catalog button |
| 7 | **Serials Management** | `/serials` | `media_1794247741837_501eb552.jpg` | ISSN subscriptions, frequency schedule, issue check-in |
| 8 | **Members Management** | `/members` | `media_1794247726395_29c03eb0.jpg` | Patron directory, smart card UID resolution, status badges |
| 9 | **Circulation Desk** | `/circulation` | `media_1794243114792_73584ab2.jpg` | Patron checkout, return processing, active loans, fine settlement |
| 10 | **RFID Tagging** | `/rfid/tagging` | *Manual capture checklist provided in Section 2* | EPC/TID encoding, copy binding, EAS bit toggle |
| 11 | **RFID Devices** | `/rfid/devices` | `media_1794246754719_909705cb.jpg` | Device registry, live status telemetry, antenna power |
| 12 | **RFID Inventory** | `/inventory` | `media_1794245972883_d05b1fee.jpg` | Bulk handheld sweeps, shelf reconciliation, missing items |
| 13 | **Security Gate** | `/security-gate` | `media_1794042246091_dd203674.jpg` | Live transit telemetry, EAS alarm strobe, synthetic CCTV frame |
| 14 | **Data Migration** | `/migration` | `media_1794246789949_a521b3bb.jpg` | File upload, column mapper, dry-run projection, rollback |
| 15 | **Reports & Analytics** | `/reports` | `media_1794246761786_92d45d40.jpg` | 10 institutional reports, date filters, CSV/PDF export |
| 16 | **Notification Center** | `/notifications` | `media_1794246800870_7a602782.jpg` | Message queue, pending/sent state machine, channel logs |
| 17 | **Barcode & Spine Labels** | `/labels` | `media_1794244645405_5c694fb3.jpg` | Code-128B SVG barcode preview, printable PDF sheets |
| 18 | **Settings & Policies** | `/settings` | `media_1794246811344_3d3855c4.jpg` | 6 configuration tabs, loan durations, daily fine rates |
| 19 | **Users & Roles** | `/users` | *Manual capture checklist provided in Section 2* | Staff user directory, role assignment, permissions |
| 20 | **Audit Trail** | `/audit` | *Manual capture checklist provided in Section 2* | Chronological audit log, action filter, JSON payload view |
| 21 | **Backup & Health** | `/backup` | *Manual capture checklist provided in Section 2* | Liveness probe, SQL backup trigger, isolated restore |
| 22 | **Public OPAC & Bookshelf**| `/opac` | `uploaded_media_1793978332262.jpg` | Zero-auth search, copy availability, virtual bookshelf |

---

## 2. Evaluator Manual Screenshot Capture Checklist

If an evaluator wishes to capture fresh screenshots of all 22 modules:

1. **Start Services**:
   - Backend: `npm --prefix backend run dev` (Port 5000)
   - Frontend: `npm --prefix frontend run dev` (Port 5173)
   - RFID Middleware: `uvicorn main:app --port 8000` (Port 8000)
2. **Login Credentials**:
   - URL: `http://localhost:5173/login`
   - Email: `admin@smartlib.ac.in` | Password: `Admin@123456`
3. **Capture Sequence**:
   - Capture `http://localhost:5173/` (Landing & Dashboard)
   - Capture `http://localhost:5173/books` & `/cataloguing`
   - Capture `http://localhost:5173/acquisitions` & `/members`
   - Capture `http://localhost:5173/circulation` & `/labels`
   - Capture `http://localhost:5173/rfid/tagging`, `/rfid/devices`, `/inventory`, `/security-gate`
   - Capture `http://localhost:5173/migration`, `/reports`, `/notifications`
   - Capture `http://localhost:5173/settings`, `/users`, `/audit`, `/backup`
   - Log out and capture `http://localhost:5173/opac` and `http://localhost:5173/bookshelf`

---

## 3. Automated Test Execution Evidence Directory (`docs/evidence/test-logs/`)

The following raw execution logs are archived in `docs/evidence/test-logs/`:

1. `backend-test-run-1.log`: Full backend Vitest log (Run 1: 17/17 passed, 129/129 passed; Exit Code 0).
2. `backend-test-run-2.log`: Full backend Vitest log (Run 2: 16/17 passed, 128/129 passed; Exit Code 1).
3. `backend-test-run-3.log`: Full backend Vitest log (Run 3: 17/17 passed, 129/129 passed; Exit Code 0).
4. `backend-test-runs-summary.txt`: Three-run summary log with timestamps and duration.

