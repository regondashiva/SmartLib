# SmartLib v1.6.0 — Evaluator Demonstration Guide

**Document ID:** `SMARTLIB-DEMONSTRATION-GUIDE-v1.6.0`  
**Application:** SmartLib RFID-Enabled Integrated Library Management System  
**Estimated Walkthrough Time:** 10–15 Minutes  
**Target Audience:** AISYS Technical Evaluators, System Assessors, and Academic Librarians  

---

## 1. Demonstration Setup & Prerequisites

Before starting the demonstration, ensure all three services are running:

```powershell
# Terminal 1: Backend API (Port 5000)
cd backend
npm run dev

# Terminal 2: RFID Middleware (Port 8000)
cd rfid-service
.\venv\Scripts\activate
uvicorn main:app --port 8000 --reload

# Terminal 3: Web Frontend (Port 5173)
cd frontend
npm run dev
```

### Verified Demo Accounts (Do Not Use Production Credentials)

| Role | Username / Email | Password | Intended Demo Steps |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@smartlib.ac.in` | `Admin@123456` | Full system audit, settings, audit trail, backup & restore |
| **Librarian** | `librarian@smartlib.ac.in` | `Librarian@123` | Cataloguing, members, circulation, RFID inventory |
| **Patron / Student** | `student@smartlib.ac.in` | `Student@123` | Public OPAC discovery and virtual bookshelf |

> **Evaluator Notice**: All physical RFID hardware readers, CCTV cameras, and telecom SMS/email gateways operate via **software emulation and mock adapters** for deterministic evaluation.

---

## 2. Step-by-Step 12-Stage Evaluation Walkthrough (10–15 Minutes)

### Step 1: Landing Page Discovery (Minute 1)
- **URL**: `http://localhost:5173/` (unauthenticated).
- **Actions**:
  1. Observe the institutional landing portal.
  2. Notice the quick pathways to **Browse Public OPAC** and **Staff Login**.
  3. Click **Staff Login**.

### Step 2: Authentication & Role-Based Routing (Minute 2)
- **URL**: `http://localhost:5173/login`.
- **Actions**:
  1. Click the **Admin Demo** quick-fill button (or enter `admin@smartlib.ac.in` / `Admin@123456`).
  2. Click **Sign In**.
  3. The system validates the bcrypt-hashed password, issues a JWT token, and redirects to the Executive Dashboard.

### Step 3: Executive Dashboard Overview (Minute 3)
- **URL**: `http://localhost:5173/` (authenticated).
- **Actions**:
  1. Review the 8 live KPI cards: Total Titles (`52`), Physical Copies (`101`), Active Members (`14`), and System Health status (`Healthy`).
  2. Observe the weekly circulation trend chart and category breakdown widget.

### Step 4: Catalog Exploration (Minute 4)
- **URL**: `http://localhost:5173/books`.
- **Actions**:
  1. Type a query in the search bar (e.g., `Design Patterns` or `Computer`).
  2. Filter by category or loan availability.
  3. Click **Details** on any title to expand the drawer showing physical copies, unique accession numbers, shelf locations (Floor, Rack, Shelf), and RFID EPC bindings.

### Step 5: Bibliographic Cataloguing & Sequential Accessioning (Minute 5)
- **URL**: `http://localhost:5173/cataloguing`.
- **Actions**:
  1. Enter a valid ISBN-13 (e.g., `9780137081073`).
  2. Fill Title, Author, Category, and Call Number (`QA76.73`).
  3. Set Copies to `2`.
  4. Click **Save & Accession**.
  5. Verify that the title is created and two new physical copies are provisioned with unique sequential accession numbers (`ACC-2026-XXXXX`).

### Step 6: Patron Registration & Smart Card Binding (Minute 6)
- **URL**: `http://localhost:5173/members`.
- **Actions**:
  1. Click **Add Member**.
  2. Enter patron name (e.g., `Elena Rostova`), institutional email, and select category (`STUDENT`).
  3. Input contactless Smart Card UID (e.g., `CARD-E0-44-12`).
  4. Click **Register Patron**. The patron profile is created with borrowing limit enforced (4 books).

### Step 7: Front-Desk Circulation (Issue, Return, Renewal) (Minutes 7–8)
- **URL**: `http://localhost:5173/circulation`.
- **Actions**:
  1. Select **Issue Book**.
  2. Enter the patron card UID or membership number.
  3. Enter the accession number of an available circulating book.
  4. Click **Confirm Issue**.
  5. The loan is created and the tag's EAS security bit is disarmed (`easArmed: false`).
  6. Switch to **Return Book**, scan the accession number, select condition (`GOOD`), and confirm return. The EAS bit is re-armed.

### Step 8: RFID Tagging & Handheld Inventory Simulation (Minutes 9–10)
- **URLs**: `http://localhost:5173/rfid/tagging` and `/inventory`.
- **Actions**:
  1. On `/rfid/tagging`, select an untagged physical copy, click **Encode Tag**, and observe EPC generation and EAS bit arming.
  2. On `/inventory`, trigger a simulated handheld shelf sweep.
  3. Observe immediate classification into **Verified** (on shelf), **Misplaced** (wrong rack), and **Missing**.

### Step 9: Security Gate Transit & EAS Alarm Simulation (Minute 11)
- **URL**: `http://localhost:5173/security-gate`.
- **Actions**:
  1. Observe real-time gate transit telemetry and footfall counters.
  2. Trigger a transit event with an armed tag (`easArmed: true`).
  3. The visual/audible alarm strobe fires, an incident is recorded in the gate event log, and a synthetic CCTV frame (`CAM-GATE-01_...`) is attached.

### Step 10: Reports & Notification Queue (Minute 12)
- **URLs**: `http://localhost:5173/reports` and `/notifications`.
- **Actions**:
  1. On `/reports`, select **Overdue Loans Report** or **Collection Valuation**, apply date filters, and click **Export PDF** or **Export CSV** (neutralized against formula injection).
  2. On `/notifications`, observe the asynchronous message queue showing notification state transitions (`PENDING` -> `SENT`).

### Step 11: Public OPAC & Virtual Bookshelf (Minute 13)
- **URL**: `http://localhost:5173/opac`.
- **Actions**:
  1. Open an incognito browser window or log out.
  2. Search for any monograph.
  3. Notice that title and availability are displayed with zero patron PII exposed.
  4. Add an item to the **Virtual Bookshelf** reading list.

### Step 12: Compliance Audit Trail & Disaster Recovery (Minutes 14–15)
- **URLs**: `http://localhost:5173/audit` and `/backup`.
- **Actions**:
  1. Log back in as `admin@smartlib.ac.in`.
  2. Navigate to `/audit` to inspect the immutable chronological audit log. Notice every checkout, cataloguing, and login action is recorded with user ID and client IP.
  3. Navigate to `/backup`, click **Create Backup** to generate a complete SQL snapshot with SHA-256 verification, and click **Verify Restore** into an isolated test schema.

