# SmartLib v1.6.0 — REST API Documentation

> **Official Submission Document**  
> **Master Reference:** [docs/API_DOCUMENTATION.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/API_DOCUMENTATION.md)

## REST API Overview

All core backend endpoints are exposed under `/api/v1` over HTTP/HTTPS:
- **Authentication**: Bearer JWT Token (`Authorization: Bearer <token>`).
- **Validation**: Strict Zod schema validation on request parameters, query strings, and payloads.
- **Envelope Standard**:
  ```json
  {
    "success": true,
    "data": { ... },
    "message": "Operation completed successfully"
  }
  ```
- **Key Endpoint Groups**:
  - `/api/v1/auth`: Login, profile retrieval, refresh tokens.
  - `/api/v1/books`: Bibliographic cataloguing, accession search, copy drawer.
  - `/api/v1/circulation`: Issue, return, renewal, and fine payments.
  - `/api/v1/members`: Patron directory and instant smart-card UID lookup.
  - `/api/v1/rfid`: Tag encoding, reassignment, handheld sweeps, gate transit alarms.
  - `/api/v1/acquisitions`: Supplier POs and receiving-to-catalog conversion.
  - `/api/v1/serials`: Journal subscriptions and issue check-ins.
  - `/api/v1/migration`: Staging upload, validation dry-run, commit, rollback.
  - `/api/v1/reports`: 10 institutional reports with CSV/PDF exports.
  - `/api/v1/labels`: Code-128B barcode generation and printable PDF sheets.
  - `/api/v1/system`: Health probe, audit logs, policy settings, backup/restore.
  - `/api/v1/opac`: Unauthenticated ranked search and virtual bookshelf.

For detailed endpoint contracts, parameters, and status codes, see [docs/API_DOCUMENTATION.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/API_DOCUMENTATION.md).

