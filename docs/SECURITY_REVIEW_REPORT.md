# SmartLib — Security Review & Hardening Report

**Date:** November 9, 2026  
**System Version:** `1.5.0`  

---

## 1. Authentication & Session Security

- **Password Storage:** All user passwords in the `users` table are hashed using `bcryptjs` (cost factor 10+). Plaintext passwords are never stored or logged.
- **JWT Token Architecture:**
  - Access tokens are signed with `JWT_ACCESS_SECRET` (short TTL, default `15m`) and carry `{ userId, email, role }`.
  - Refresh tokens are signed with `JWT_REFRESH_SECRET` (default `7d`).
  - `authenticate` middleware (`backend/src/middleware/auth.ts`) validates token signature and expiration on all protected routes, returning `401 Unauthorized` for missing, malformed, or expired tokens.
- **Brute-Force & Rate-Limiting Protection:**
  - `backend/src/middleware/rateLimit.ts` enforces a sliding-window IP rate limiter on `POST /api/v1/auth/login` (default 15 requests / 15-minute window), emitting `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` headers and returning `HTTP 429 Too Many Requests` when exceeded.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Functional Domain / Endpoint | `ADMIN` | `LIBRARIAN` | `RFID_OPERATOR` | Unauthenticated |
|---|---|---|---|---|
| `POST /api/v1/auth/login` | Allowed | Allowed | Allowed | Allowed (Rate-Limited) |
| `GET /api/v1/books`, `GET /api/v1/books/:id` | Allowed | Allowed | Allowed | Allowed (Public OPAC) |
| `POST /api/v1/books`, `PUT /api/v1/books/:id` | Allowed | Allowed | **Blocked (403)** | **Blocked (401)** |
| `POST /api/v1/circulation/issue`, `/renew`, `/return` | Allowed | Allowed | **Blocked (403)** | **Blocked (401)** |
| `POST /api/v1/circulation/fines/pay` | Allowed | Allowed | **Blocked (403)** | **Blocked (401)** |
| `POST /api/v1/circulation/fines/waive` | Allowed | **Blocked (403)** | **Blocked (403)** | **Blocked (401)** |
| `POST /api/v1/rfid/tags`, `/gate-events`, `/inventory-sessions` | Allowed | Allowed | Allowed | **Blocked (401)** |
| `POST /api/v1/migrations/upload`, `/validate`, `/dry-run` | Allowed | Allowed | **Blocked (403)** | **Blocked (401)** |
| `POST /api/v1/migrations/:id/commit`, `/rollback` | Allowed | **Blocked (403)** | **Blocked (403)** | **Blocked (401)** |
| `GET /api/v1/reports/*` | Allowed (Full PII) | Allowed (Full PII) | Allowed (**PII Masked**) | **Blocked (401)** |
| `GET /api/v1/settings` | Allowed | Allowed (Read-Only) | **Blocked (403)** | **Blocked (401)** |
| `PUT /api/v1/settings`, `GET /api/v1/settings/history` | Allowed | **Blocked (403)** | **Blocked (403)** | **Blocked (401)** |
| `/api/v1/system/*` (Backups, Updates, Rollback) | Allowed | **Blocked (403)** | **Blocked (403)** | **Blocked (401)** |

---

## 3. Input Validation, File Upload & Path Traversal Defenses

- **Schema Validation:** All request bodies, query parameters, and URL parameters are validated using strict **Zod** schemas (`validateRequest` middleware), stripping unknown properties and rejecting malformed payloads with `400 Bad Request`.
- **SQL Injection Prevention:** All database queries use parameterized **Prisma ORM** operations or parameterized tagged template literals (`prisma.$queryRaw`), preventing SQL injection.
- **Migration File Upload Hardening:**
  - `POST /api/v1/migrations/upload` restricts uploads to `.csv`, `.xlsx`, `.xls`, and `.json` (MARC21-JSON) up to the configured size limit (`15 MB`) and rejects executable/script extensions (`.js`, `.exe`, `.sh`, `.ps1`) with `400 Bad Request`.
- **Offline Package Path Traversal Protection:**
  - `system.service.ts` inspects every artifact `relativePath` in update manifests and rejects any path containing `..`, leading `/`, Windows drive prefixes (`C:\`), or null bytes.

---

## 4. Secret Hygiene & PII Protection

- **Zero Secrets in Responses:** `GET /api/v1/settings` and `GET /api/v1/system/health` never expose `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, or password hashes.
- **Role-Based PII Redaction:** In `GET /api/v1/reports/overdue`, `GET /api/v1/reports/members`, and `GET /api/v1/reports/fines`, patron email addresses and phone numbers are only returned to `ADMIN` and `LIBRARIAN` roles; for other roles, contact fields are masked (`[REDACTED]`).
- **HTTP Security Headers:** Express is configured with `helmet` and explicit `cors` origin policies.

