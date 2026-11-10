# SmartLib v1.6.0 — User Manual

> **Official Submission Document**  
> **Master Reference:** [docs/USER_MANUAL.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/USER_MANUAL.md)

## Summary of Operational Roles & Workflows

SmartLib v1.6.0 includes comprehensive operational workflows tailored to institutional library personas:

1. **System Administrator** (`admin@smartlib.ac.in` / `Admin@123456`):
   - Configure institutional circulation policies, fine rates, and borrowing caps (`/settings`).
   - Monitor system health, execute automated SQL database backups, and verify isolated restore (`/backup`).
   - Audit immutable activity trails across all actors and IP addresses (`/audit`).
2. **Librarian / Cataloguer** (`librarian@smartlib.ac.in` / `Librarian@123`):
   - Ingest bibliographic titles and provision sequential unique accessions (`/cataloguing`).
   - Manage library supplier purchase orders and convert shipments to catalog (`/acquisitions`).
   - Track serial subscriptions and issue check-ins (`/serials`).
   - Process checkouts, returns, renewals, and overdue fines (`/circulation`).
3. **RFID Operator** (`rfid.operator@smartlib.ac.in` / `Operator@123`):
   - Commission and write EPC/TID data to new tags with EAS security bit arming (`/rfid/tagging`).
   - Perform rapid handheld inventory sweeps across physical shelves (`/inventory`).
   - Monitor real-time security gate transits and respond to unauthorized alarms (`/security-gate`).
4. **Patron / Student** (`student@smartlib.ac.in` / `Student@123`):
   - Perform zero-PII catalog searches via Public OPAC (`/opac`).
   - Build private reading lists in the Virtual Bookshelf (`/bookshelf`).

For complete step-by-step instructions with screenshots and operational runbooks, see [docs/USER_MANUAL.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/USER_MANUAL.md).

