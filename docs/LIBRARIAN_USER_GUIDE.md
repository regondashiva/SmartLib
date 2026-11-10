# SmartLib — Librarian & RFID Operator User Guide (v1.5.0)

**Target Audience:** Library Staff (`LIBRARIAN`) and Floor/Technical Staff (`RFID_OPERATOR`)  

---

## 1. Cataloguing & Physical Copy Management (`/catalog`)

1. **Searching the Catalog:**
   - Use the search bar and filters (Category, Language, Availability) to locate bibliographic titles and inspect copy-level availability and shelf locations.
2. **Creating a New Book & Copies (`LIBRARIAN` / `ADMIN`):**
   - Click **Add New Book** and enter bibliographic details (Title, Subtitle, ISBN-13, Authors, Publisher, Category, Call Number, Publication Year).
   - Specify initial physical copy count (`copiesCount`), `shelfLocation`, `condition`, and whether copies are `isReferenceOnly`.
   - SmartLib automatically generates sequential `ACC-YYYY-NNNNN` accession numbers and barcodes for each physical copy.

---

## 2. RFID Tag Encoding & Binding (`/rfid-workstation`)

1. Place the physical book on the staff RFID pad (or select an EPC in Mock Emulator mode).
2. Scan or enter the copy's `accessionNumber` and bind the EPC tag (`POST /api/v1/rfid/tags`).
3. SmartLib verifies that neither the EPC nor the book copy is already bound, encodes `easArmed = true`, sets tag status to `ACTIVE`, and logs the encoding event.

---

## 3. Circulation Desk Operations (`/circulation`)

1. **Patron Identification:**
   - Scan the patron's contactless Smart Card (`GET /api/v1/members/card/:uid`) or search by Card Number / Name.
   - Verify that the patron's status is `ACTIVE` and their unpaid fine balance is below the institutional block threshold.
2. **Issuing (Checking Out) a Book:**
   - Scan the book copy's RFID tag or barcode and click **Issue Book**.
   - SmartLib atomically updates the copy status to `ISSUED`, calculates the due date based on the patron's category policy, and **disarms the RFID EAS security bit** (`easArmed = false`) so the patron can exit the security gate without triggering an alarm.
3. **Renewing a Loan:**
   - Select an active loan and click **Renew**. SmartLib extends the due date according to institutional policy unless the maximum renewal count has been reached or the patron is blocked.
4. **Returning (Checking In) a Book:**
   - Scan the returned copy and click **Return Book**.
   - SmartLib sets the copy status back to `AVAILABLE`, **re-arms the RFID EAS security bit** (`easArmed = true`), and automatically calculates any overdue fine based on the configured daily rate.
5. **Collecting Fines:**
   - Record full or partial fine payments (`CASH`, `CARD`, `UPI`) to immediately reduce the patron's outstanding balance and generate a receipt reference.

---

## 4. Handheld Shelf Inventory & Security Gate Monitoring

- **Handheld Inventory (`/inventory`):** Select a target shelf location (e.g., `STACK-A/AISLE-01`), perform an RFID handheld sweep, and review reconciled counts for **Verified**, **Misplaced** (wrong shelf), **Missing** (expected on shelf but not detected), and **Uncataloged** tags.
- **Security Gate Monitor (`/security-gates`):** Monitor real-time pedestal passage events, bidirectional footfall counts, and EAS alarm incidents with correlated CCTV timestamp references (`CAM-GATE-01_...`).

