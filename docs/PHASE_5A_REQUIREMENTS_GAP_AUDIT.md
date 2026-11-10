# SmartLib — Phase 5A: Complete AISYS Requirements Gap Audit

**Audit Date:** November 9, 2026  
**Audited Version:** `1.5.0` (Pre-Phase 5A) → Target `1.6.0` (Phase 5A Complete)  
**Objective:** Exhaustive code-level audit of every functional, web/search, and interoperability requirement in the AISYS Candidate Software Development SOP prior to final gap-closure engineering.

---

## 1. Executive Audit Summary

| Part / Section | Requirement Domain | Pre-5A Status | Post-5A Target | Action Required |
|---|---|---|---|---|
| **2.1** | Acquisition Management (Requests, Suppliers, POs, Receiving → Catalog) | **MISSING** | **PASS** | Implement `/api/v1/acquisitions` + `/acquisitions` UI + tests |
| **2.2** | Bibliographic Cataloguing & Copy Management | **PASS** | **PASS** | Preserve & verify subject/classification/duplicate guards |
| **2.3** | Serials Management (Journals, ISSN, Issues, Missing/Renewal Tracking) | **MISSING** | **PASS** | Implement `/api/v1/serials` + `/serials` UI + tests |
| **2.4** | Circulation & Dedicated Due-Date Enquiry | **PARTIAL** | **PASS** | Add `GET /api/v1/circulation/due-date-enquiry` + UI tab |
| **2.5** | Barcode & Spine-Label Management (`/labels`, Code-128 SVG & PDF) | **MISSING** | **PASS** | Implement `/api/v1/labels` + `/labels` UI + PDF output |
| **3.1** | Public Online Access Catalogue (`/opac` without login, PII-free) | **MISSING** | **PASS** | Implement `/api/v1/opac` + public `/opac` UI route |
| **3.2** | Full-Text Search & Relevance Ranking | **PARTIAL** | **PASS** | Add ranked multi-field search across title/author/ISBN/publisher/subject/description |
| **3.3** | Provider-Neutral Net Cataloguing Adapter & Import | **MISSING** | **PASS** | Implement Net Cataloguing adapter + preview/import API & UI |
| **3.4** | Virtual Bookshelf & Personal Reading Lists | **MISSING** | **PASS** | Implement `/api/v1/bookshelf` (user-isolated) + `/bookshelf` UI |
| **4.1** | Device-Neutral Architecture (9 Hardware/Service Adapter Interfaces) | **PARTIAL** | **PASS** | Implement unified 9-adapter registry (`Staff`, `Handheld`, `Gate`, `SmartCard`, `RFIDTag`, `Camera`, `Printer`, `Email`, `SMS`) |
| **4.2** | NCIP 2.0 Protocol Adapter Boundary | **MISSING** | **PASS** | Implement NCIP 2.0 request/response mapper & mock provider (`/api/v1/adapters/ncip`) |
| **4.3** | 3M SIP2 Protocol Adapter Boundary | **MISSING** | **PASS** | Implement SIP2 parser/serializer (`93/94`, `99/98`, `63/64`, `17/18`, `11/12`, `09/10`, `29/30`) & mock provider (`/api/v1/adapters/sip2`) |
| **4.4** | Staff RFID Reader (Lookup, Unknown Tag Detection, Audited Reassignment) | **PARTIAL** | **PASS** | Add `PUT /api/v1/rfid/tags/:id/reassign` with audit trail |
| **4.5** | Handheld RFID Reader (Bulk EPC, Duplicate Filtering, Reconciliation) | **PASS** | **PASS** | Verified in `POST /api/v1/rfid/inventory-sessions` |

---

## 2. Detailed Requirement-by-Requirement Audit Matrix

###REQ-5A-01 (SOP 2.1) — Acquisition Management
1. **AISYS Requirement ID:** `SOP-2.1`
2. **Exact Requirement:** Complete acquisition workflow including acquisition requests, requested books/quantities, supplier records, purchase orders, ordered/received/pending quantity tracking, conversion of received items into catalogued books and physical copies without duplicates, status/history tracking, and acquisition reports.
3. **Existing Implementation:** None (`Book` and `BookItem` are created directly via cataloguing or migration).
4. **Existing File/API/Page:** N/A.
5. **Test Evidence:** None prior to Phase 5A.
6. **Pre-5A Status:** `MISSING`
7. **Corrective Action:** Create `backend/src/modules/acquisitions/` (`GET/POST /api/v1/acquisitions/suppliers`, `GET/POST /api/v1/acquisitions/requests`, `GET/POST /api/v1/acquisitions/orders`, `POST /api/v1/acquisitions/orders/:id/receive`, `GET /api/v1/acquisitions/reports`) with transactional cataloguing conversion and `frontend/src/pages/acquisitions/Acquisitions.tsx` (`/acquisitions`).

---

### REQ-5A-02 (SOP 2.2) — Cataloguing
1. **AISYS Requirement ID:** `SOP-2.2`
2. **Exact Requirement:** Support title, ISBN, author, publisher, edition, publication year, subject/category, language, classification/call number, accession number, multiple physical copies, condition, availability, reference-only status, validation, and duplicate detection.
3. **Existing Implementation:** Implemented in `BooksService` with Prisma transactions, ISBN-13 & accession collision checks, and sequential `ACC-YYYY-NNNNN` generation.
4. **Existing File/API/Page:** `backend/src/modules/books/books.service.ts`, `frontend/src/pages/cataloguing/Cataloguing.tsx`.
5. **Test Evidence:** `backend/tests/phase4a-cataloguing.test.ts` (12/12 passing).
6. **Pre-5A Status:** `PASS`
7. **Corrective Action:** Extend with Net Cataloguing metadata lookup/import (SOP 3.3) while preserving all existing cataloguing behavior.

---

### REQ-5A-03 (SOP 2.3) — Serials Management
1. **AISYS Requirement ID:** `SOP-2.3`
2. **Exact Requirement:** Manage journals/periodicals with ISSN validation (`XXXX-XXXX`), publisher, volume/issue tracking, publication frequency, subscription start/end dates, expected issue dates, received/missing issue tracking, subscription renewal tracking, search/filtering, and serials reports.
3. **Existing Implementation:** None.
4. **Existing File/API/Page:** N/A.
5. **Test Evidence:** None prior to Phase 5A.
6. **Pre-5A Status:** `MISSING`
7. **Corrective Action:** Create `backend/src/modules/serials/` (`GET/POST /api/v1/serials`, `GET/PUT /api/v1/serials/:id`, `POST /api/v1/serials/:id/issues`, `PUT /api/v1/serials/issues/:issueId`, `GET /api/v1/serials/reports`) and `frontend/src/pages/serials/SerialsManagement.tsx` (`/serials`).

---

### REQ-5A-04 (SOP 2.4) — Circulation & Due-Date Enquiry
1. **AISYS Requirement ID:** `SOP-2.4`
2. **Exact Requirement:** Checkout, check-in, renewal, due-date enquiry, member blocking, reference-book restrictions, fine calculation/payment/waiver, configurable limits, EAS state management, and audit history.
3. **Existing Implementation:** Checkout, check-in, renewal, fine calculation/payment/waiver, policy integration, and EAS bit management are implemented in `CirculationService`. Dedicated due-date enquiry endpoint is missing.
4. **Existing File/API/Page:** `backend/src/modules/circulation/circulation.service.ts`, `frontend/src/pages/circulation/Circulation.tsx`.
5. **Test Evidence:** `backend/tests/phase4b-circulation.test.ts` (14/14 passing).
6. **Pre-5A Status:** `PARTIAL`
7. **Corrective Action:** Add `GET /api/v1/circulation/due-date-enquiry` (lookup by accession number, barcode, book title, or member card number returning due date, days remaining/overdue, renewal eligibility, and estimated fine) and integrate into `Circulation.tsx`.

---

### REQ-5A-05 (SOP 2.5) — Barcode & Spine-Label Management
1. **AISYS Requirement ID:** `SOP-2.5`
2. **Exact Requirement:** Generate unique barcodes for copies, prevent duplicates, preview Code-128 barcodes and spine labels (call number + accession number), support configurable label dimensions and bulk generation, and output print-ready PDF sheets at `/labels`.
3. **Existing Implementation:** `BookItem.barcode` is generated during cataloguing, but no barcode/spine-label preview or PDF printing module exists.
4. **Existing File/API/Page:** N/A.
5. **Test Evidence:** None prior to Phase 5A.
6. **Pre-5A Status:** `MISSING`
7. **Corrective Action:** Create `backend/src/modules/labels/` (`POST /api/v1/labels/assign-barcode`, `POST /api/v1/labels/preview`, `POST /api/v1/labels/pdf`) using deterministic Code-128B SVG encoding and PDF sheet generation, plus `frontend/src/pages/labels/LabelsManagement.tsx` (`/labels`).

---

### REQ-5A-06 (SOP 3.1, 3.2, 3.3, 3.4) — Public OPAC, Full-Text Search, Net Cataloguing & Virtual Bookshelf
1. **AISYS Requirement ID:** `SOP-3.1` – `SOP-3.4`
2. **Exact Requirement:**
   - Unauthenticated `/opac` route with search by title, author, ISBN, subject, publisher, accession number, category; sorting, pagination, availability, related books, and strict PII isolation.
   - Ranked full-text search across bibliographic fields with partial-word matching.
   - Provider-neutral Net Cataloguing adapter with preview and duplicate ISBN prevention.
   - Virtual Bookshelf with personal reading lists isolated per user.
3. **Existing Implementation:** `GET /api/v1/books` is public on the backend, but all frontend routes require login (`<ProtectedRoute>`), and Net Cataloguing / Virtual Bookshelf are not implemented.
4. **Existing File/API/Page:** `backend/src/modules/books/`.
5. **Test Evidence:** `phase4a-cataloguing.test.ts`.
6. **Pre-5A Status:** `PARTIAL` / `MISSING`
7. **Corrective Action:** Create `/api/v1/opac` (ranked full-text search + related books + Net Cataloguing lookup/import + Virtual Bookshelf endpoints) and public/authenticated frontend pages `/opac` and `/bookshelf`.

---

### REQ-5A-07 (SOP 4.1, 4.2, 4.3, 4.4, 4.5) — Device-Neutral Adapters, NCIP 2.0, SIP2 & Tag Reassignment
1. **AISYS Requirement ID:** `SOP-4.1` – `SOP-4.5`
2. **Exact Requirement:**
   - 9 device-neutral adapter interfaces (`StaffReader`, `HandheldReader`, `SecurityGate`, `SmartCard`, `RFIDTag`, `Camera`, `Printer`, `Email`, `SMS`) with capabilities, commands, events, retry/timeout policies, health checks, and mock implementations.
   - NCIP 2.0 adapter boundary (`LookupUser`, `LookupItem`, `CheckOutItem`, `CheckInItem`, `RenewItem`).
   - 3M SIP2 adapter boundary (message parser & serializer for `93/94`, `99/98`, `63/64`, `17/18`, `11/12`, `09/10`, `29/30` with checksum validation).
   - Staff RFID reader tag reassignment with audit history.
3. **Existing Implementation:** Python middleware implements Staff, Handheld, and Gate drivers; backend lacks the unified 9-adapter registry, NCIP 2.0 endpoint, SIP2 parser/serializer endpoint, and tag reassignment endpoint.
4. **Existing File/API/Page:** `rfid-service/drivers/`, `backend/src/modules/rfid/`.
5. **Test Evidence:** `rfid-service/tests/` (21/21 passing).
6. **Pre-5A Status:** `PARTIAL` / `MISSING` → **Post-5A Final Status:** **`PASS` (Verified)**
7. **Corrective Action & Verification Evidence:** Created `backend/src/modules/adapters/` implementing the 9 device-neutral adapters (`GET /api/v1/adapters/devices`, `POST /api/v1/adapters/devices/:adapterType/command`), NCIP 2.0 protocol boundary (`POST /api/v1/adapters/ncip`), and 3M SIP2 protocol boundary (`POST /api/v1/adapters/sip2`), plus added `PUT /api/v1/rfid/tags/:id/reassign` to `RFIDService`. All 14 requirement domains (`2.1`–`4.5`) verified against live Neon PostgreSQL in `backend/tests/phase5a-gap-closure.test.ts` (5/5 suites passing) and `frontend/src/tests/phase5a.test.tsx` (3/3 tests passing).


