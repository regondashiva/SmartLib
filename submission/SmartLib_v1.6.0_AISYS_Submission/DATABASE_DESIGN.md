# SmartLib v1.6.0 — Database Design

> **Official Submission Document**  
> **Master Reference:** [docs/DATABASE_DESIGN.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/DATABASE_DESIGN.md)

## Relational Schema & 3NF Data Model Overview

The SmartLib data model is specified using Prisma schema definition language (`backend/prisma/schema.prisma`) and hosted on PostgreSQL 18.6:

### Key Relational Entities (18 Tables)
1. `User` & `Role`: System authentication, credentials, staff roles, and status flags.
2. `Book`: Master bibliographic records (ISBN, Title, Authors, Publisher, Category, Call Number).
3. `BookItem`: Physical book copies with unique Accession Numbers, condition, barcode, and shelf location.
4. `RFIDTag`: Bound RFID tags (EPC, TID, EAS armed status) linked 1-to-1 to physical `BookItem` copies.
5. `RFIDDevice`: Hardware directory of registered staff stations, gates, and scanners.
6. `Member`: Patron profiles, category limits (`STUDENT`, `FACULTY`), smart card UIDs, and fine balances.
7. `Circulation`: Transactional loan history (issue date, due date, return date, renewal counts).
8. `Fine`: Overdue penalty records, payment receipts, waiver audits.
9. `PurchaseOrder` & `OrderItem`: Acquisition lifecycle records from supplier quote to catalog conversion.
10. `Serial` & `SerialIssue`: Periodicals, ISSN validation, publication frequency schedules.
11. `GateEvent`: Real-time transit events, EAS alarms, footfall counts, synthetic CCTV references.
12. `Notification`: Asynchronous message queue records (`PENDING`, `SENT`, `FAILED`, `RETRY`).
13. `SystemConfiguration`: Global institutional settings, loan durations, daily fine rates.
14. `AuditLog`: Immutable, append-only security and administrative audit trail.

Please refer to [docs/DATABASE_DESIGN.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/DATABASE_DESIGN.md) for full entity-relationship diagrams, foreign key constraints, indexes, and trigger logic.

