# SmartLib v1.6.0 — Official User Manual

**Document ID:** `SMARTLIB-USER-MANUAL-v1.6.0`  
**Application:** SmartLib RFID-Enabled Integrated Library Management System  
**Audience:** System Administrators, Chief Librarians, Cataloguers, Front-Desk Staff, RFID Operators, and Patrons  

---

## 1. Getting Started & Logging In

### 1.1 Accessing the Application
- Open any modern web browser (Google Chrome, Microsoft Edge, Firefox).
- Navigate to: `http://localhost:5173` (or the institutional library domain).
- The public **Landing Page** appears.

### 1.2 Demo Credentials for Evaluation

| Role | Email Address | Password | Permissions & Scope |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@smartlib.ac.in` | `Admin@123456` | Full administrative authority, settings, user management, audit logs, backup & restore. |
| **Librarian** | `librarian@smartlib.ac.in` | `Librarian@123` | Cataloguing, accessioning, acquisitions, serials, circulation, fine waivers, and reports. |
| **RFID Operator** | `rfid.operator@smartlib.ac.in` | `Operator@123` | Tag commissioning, EPC encoding, handheld shelf sweeps, gate monitoring. |
| **Student / Patron** | `student@smartlib.ac.in` | `Student@123` | Public OPAC, virtual bookshelf, due-date enquiry, and reading history. |

---

## 2. Front-Desk Circulation Workflows

### 2.1 Checking Out a Book (Issue Workflow)
1. Navigate to **Circulation** (`/circulation`) from the left sidebar.
2. Under the **Issue Book** tab, scan or type the patron's **Membership Number** or tap their **Smart Card** on the NFC reader.
3. The system validates the patron's category, verifies they have not exceeded their borrowing cap (e.g. 4 books for Students), and checks for unpaid overdue fines.
4. Scan or type the **Accession Number** of the book copy (e.g., `ACC-2026-00001`).
5. The system verifies that the item is a circulating copy (non-reference).
6. Click **Confirm Issue**.
7. The loan is created, the due date is calculated according to institutional policy, and the tag's **EAS security bit is automatically disarmed** (`easArmed: false`).

### 2.2 Returning a Book
1. On the **Circulation** page, select the **Return Book** tab.
2. Scan the **Accession Number** or **RFID EPC**.
3. The system loads the loan details and calculates overdue fines if returned past the due date.
4. Select the physical condition of the copy (e.g., `GOOD`, `MINOR_WEAR`, `DAMAGED`).
5. Click **Confirm Return**.
6. The loan status updates to `RETURNED`, fine records are generated if overdue, and the tag's **EAS security bit is re-armed** (`easArmed: true`).

### 2.3 Loan Renewal
1. Navigate to **Circulation -> Active Loans**.
2. Find the patron's active transaction.
3. Click **Renew**. The system enforces the maximum renewal cap (maximum 2 renewals per loan) and computes the updated due date.

---

## 3. Cataloguing & Acquisitions Workflows

### 3.1 Adding a New Bibliographic Title & Accessioning Copies
1. Navigate to **Cataloguing** (`/cataloguing`).
2. Enter the ISBN-13 (validated via ISO 2108 mod-10 algorithm), Title, Author(s), Publisher, Subject Category, and Call Number.
3. Specify the number of physical copies to accession (e.g., `3`).
4. Choose whether the title is **Reference Only** (Non-Circulating).
5. Specify Shelf Location (Floor, Rack, Shelf).
6. Click **Save & Accession**.
7. The system creates the master `Book` record and provisions unique sequential accession numbers (`ACC-YYYY-XXXXX`) for every copy.

### 3.2 Acquisition & Purchase Orders
1. Navigate to **Acquisition Management** (`/acquisitions`).
2. Click **Create Purchase Order**.
3. Select an approved library supplier and add line items with estimated unit costs.
4. When physical shipments arrive, click **Receive Order**.
5. Inspect received quantities and click **Convert to Catalog** to generate bibliographic records and accession numbers without re-typing.

---

## 4. RFID Hardware & Inventory Operations

### 4.1 Tag Encoding & Commissioning
1. Place a new book copy on the RFID Staff Station pad.
2. Navigate to **RFID Tagging** (`/rfid/tagging`).
3. Select or scan the accession number.
4. The system encodes the EPC and TID into the physical tag and arms the EAS anti-theft bit.

### 4.2 Handheld Shelf Inventory Sweeps
1. Connect the mobile handheld reader.
2. Navigate to **Inventory** (`/inventory`).
3. Walk along library shelf aisles while holding the trigger to sweep tags.
4. The system de-duplicates reads and reconciles results against expected shelf inventory:
   - **Green (`VERIFIED`)**: Book is on correct shelf.
   - **Yellow (`MISPLACED`)**: Book belongs to a different shelf location (coordinates displayed).
   - **Red (`MISSING`)**: Catalogued book not read during sweep.
   - **Grey (`UNCATALOGED`)**: Tag read has no catalog record.

### 4.3 Security Gate Monitoring
1. Navigate to **Security Gate** (`/security-gate`).
2. Observe real-time transit telemetry and bidirectional footfall counts.
3. If an un-issued book passes the gate, an audible/visual alarm triggers, the event is logged with accession details, and a synthetic CCTV frame is attached to the incident.

---

## 5. System Administration & Compliance

### 5.1 System Policy Settings
1. Navigate to **Settings** (`/settings`) as an Administrator.
2. Modify loan duration (days), maximum concurrent loans per patron category, daily overdue fine rates, and fine waiver caps.
3. Click **Save Policy Changes**. Settings apply immediately to all circulation operations.

### 5.2 Immutable Audit Trail
1. Navigate to **Audit Logs** (`/audit`).
2. Filter logs by actor, action type (`LOGIN`, `CHECKOUT`, `GATE_ALARM`, `UPDATE`), or date range.
3. Expand any entry to inspect the full structured JSON payload and IP address.

### 5.3 Database Backup & Restore
1. Navigate to **Backup & Health** (`/backup`).
2. Click **Create Backup** to generate a complete SQL snapshot with SHA-256 verification.
3. Click **Verify Restore** to restore the snapshot into an isolated test schema without affecting production tables.

