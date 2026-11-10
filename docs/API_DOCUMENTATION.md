# SmartLib v1.6.0 — REST API Documentation

**Document ID:** `SMARTLIB-API-DOCUMENTATION-v1.6.0`  
**Base URL:** `/api/v1`  
**Authentication:** Bearer JWT Token (`Authorization: Bearer <token>`)  
**Response Envelopes:** Standard JSON envelopes (`{ success: boolean, data?: any, message?: string, error?: string }`)

---

## 1. Authentication & Session Endpoints (`/api/v1/auth`)

| Method | Endpoint | Access Role | Description | Request Body | Response |
| :---: | :--- | :---: | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Public | Authenticate staff user | `{ email, password }` | `{ token, user: { id, email, name, role } }` |
| `GET` | `/api/v1/auth/me` | Authenticated | Fetch current user profile | None | `{ user: { id, email, name, role } }` |
| `POST` | `/api/v1/auth/refresh` | Authenticated | Refresh JWT access token | `{ refreshToken }` | `{ token }` |

---

## 2. Bibliographic Catalog & Copies (`/api/v1/books`)

| Method | Endpoint | Access Role | Description | Parameters / Body |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/books` | Public / Staff | Search catalog monographs | Query: `query`, `category`, `page`, `limit` |
| `GET` | `/api/v1/books/:id` | Public / Staff | Get bibliographic title & copy details | Path: `id` |
| `POST` | `/api/v1/books` | Librarian, Admin | Create bibliographic title & copies | Body: `{ title, author, isbn, publisher, category, copiesCount, ... }` |
| `PUT` | `/api/v1/books/:id` | Librarian, Admin | Update bibliographic metadata | Body: `{ title, author, publisher, ... }` |
| `DELETE` | `/api/v1/books/:id` | Admin | Delete title (if no active loans) | Path: `id` |

---

## 3. Circulation Lifecycle & Fines (`/api/v1/circulation`)

| Method | Endpoint | Access Role | Description | Request Body |
| :---: | :--- | :---: | :--- | :--- |
| `POST` | `/api/v1/circulation/issue` | Librarian, Admin | Checkout book copy to member | `{ memberId, bookItemId }` |
| `POST` | `/api/v1/circulation/return` | Librarian, Admin | Return checked-out copy | `{ bookItemId, conditionNotes? }` |
| `POST` | `/api/v1/circulation/renew` | Librarian, Admin | Renew active loan (max 2 renewals) | `{ circulationId }` |
| `GET` | `/api/v1/circulation/active` | Librarian, Admin | List active institutional loans | Query: `page`, `limit`, `memberId?` |
| `POST` | `/api/v1/circulation/fines/pay` | Librarian, Admin | Record fine settlement or waiver | `{ fineId, amountPaid, isWaiver, notes }` |

---

## 4. Patron & Members Management (`/api/v1/members`)

| Method | Endpoint | Access Role | Description | Parameters / Body |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/members` | Librarian, Admin | List registered library patrons | Query: `page`, `limit`, `search`, `category` |
| `GET` | `/api/v1/members/:id` | Librarian, Admin | Get patron profile and active loans | Path: `id` |
| `GET` | `/api/v1/members/card/:uid` | Librarian, Admin | Instant Smart-Card UID patron lookup | Path: `uid` |
| `POST` | `/api/v1/members` | Librarian, Admin | Register new institutional patron | Body: `{ name, email, cardNumber, category, ... }` |
| `PATCH` | `/api/v1/members/:id` | Librarian, Admin | Update patron status (Active/Suspended) | Body: `{ status, department, ... }` |

---

## 5. RFID Hardware & Automation (`/api/v1/rfid`)

| Method | Endpoint | Access Role | Description | Parameters / Body |
| :---: | :--- | :---: | :--- | :--- |
| `POST` | `/api/v1/rfid/tags/encode` | Staff | Encode and bind RFID tag to `BookItem` | `{ epc, tid, bookItemId, easArmed }` |
| `PUT` | `/api/v1/rfid/tags/:id/reassign` | Staff | Audited reassignment of tag | `{ newBookItemId, reason }` |
| `POST` | `/api/v1/rfid/inventory/sweep` | Staff | Process bulk handheld inventory sweep | `{ deviceId, epcs: string[], shelfLocation }` |
| `POST` | `/api/v1/rfid/gate/transit` | System / Gate | Record security gate tag transit | `{ gateId, epcs: string[], direction }` |
| `GET` | `/api/v1/rfid/gate/events` | Staff | Fetch gate transit alarms & footfall | Query: `page`, `limit`, `severity` |
| `GET` | `/api/v1/rfid/devices` | Staff | List registered RFID hardware devices | None |

---

## 6. Acquisitions & Serials (`/api/v1/acquisitions`, `/api/v1/serials`)

| Method | Endpoint | Access Role | Description | Request Body |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/acquisitions/orders` | Librarian, Admin | List purchase orders and status | Query: `status`, `page` |
| `POST` | `/api/v1/acquisitions/orders` | Librarian, Admin | Create new supplier purchase order | `{ supplierId, expectedDate, items: [...] }` |
| `POST` | `/api/v1/acquisitions/orders/:id/receive` | Librarian, Admin | Inspect received items and convert | `{ items: [{ orderItemId, receivedQty, ... }] }` |
| `GET` | `/api/v1/serials` | Librarian, Admin | List journal/periodical subscriptions | Query: `status`, `search` |
| `POST` | `/api/v1/serials` | Librarian, Admin | Create journal subscription (ISSN) | `{ title, issn, publisher, frequency, ... }` |
| `POST` | `/api/v1/serials/:id/issues` | Librarian, Admin | Check-in received journal issue | `{ volume, issueNumber, receivedDate }` |

---

## 7. Data Migration (`/api/v1/migration`)

| Method | Endpoint | Access Role | Description | Parameters / Body |
| :---: | :--- | :---: | :--- | :--- |
| `POST` | `/api/v1/migration/upload` | Admin | Upload legacy file (CSV, XLSX, JSON) | Multipart form data: `file` |
| `POST` | `/api/v1/migration/validate` | Admin | Validate staging batch & generate dry run | `{ batchId, columnMapping }` |
| `POST` | `/api/v1/migration/commit` | Admin | Transactionally commit staged records | `{ batchId }` |
| `POST` | `/api/v1/migration/rollback` | Admin | Rollback committed migration batch | `{ batchId }` |

---

## 8. Reports & Barcode Labels (`/api/v1/reports`, `/api/v1/labels`)

| Method | Endpoint | Access Role | Description | Parameters / Body |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/reports/:type` | Staff | Generate report preview data | Path: `type`, Query: `startDate`, `endDate` |
| `GET` | `/api/v1/reports/export` | Staff | Export report to CSV or PDF | Query: `type`, `format` (`csv` \| `pdf`) |
| `POST` | `/api/v1/labels/generate` | Staff | Generate Code-128B barcodes & spine preview | `{ bookItemIds: string[] }` |
| `GET` | `/api/v1/labels/preview` | Staff | Preview printable label layout | Query: `template` (`A4_2x5`, `A4_3x8`) |

---

## 9. System Administration & Disaster Recovery (`/api/v1/system`)

| Method | Endpoint | Access Role | Description | Parameters / Body |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/health` | Public | System and database liveness probe | None |
| `GET` | `/api/v1/audit-logs` | Admin | Fetch immutable security audit trail | Query: `page`, `limit`, `action`, `actorId` |
| `GET` | `/api/v1/settings` | Admin | Retrieve institutional policy settings | None |
| `PATCH` | `/api/v1/settings` | Admin | Update circulation/fine policy settings | Body: `{ loanDuration, dailyFineRate, ... }` |
| `POST` | `/api/v1/system/backup` | Admin | Generate SQL database backup | None |
| `POST` | `/api/v1/system/restore` | Admin | Restore backup into isolated test schema | `{ backupFileId }` |
| `POST` | `/api/v1/system/updates/execute`| Admin | Execute staged 11-step update | `{ updatePackageId }` |

---

## 10. Public OPAC & Virtual Bookshelf (`/api/v1/opac`)

| Method | Endpoint | Access Role | Description | Parameters / Body |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/opac/search` | Public | Multi-field ranked catalog search | Query: `query`, `category`, `page` |
| `GET` | `/api/v1/opac/books/:id` | Public | Get title availability without PII | Path: `id` |
| `POST` | `/api/v1/opac/bookshelf/items` | Patron | Add book to private reading list | `{ memberId, bookId }` |
| `GET` | `/api/v1/opac/bookshelf` | Patron | List patron's private reading shelf | Query: `memberId` |
| `GET` | `/api/v1/opac/net-cataloguing` | Staff | Query external bibliographic source | Query: `isbn` |

