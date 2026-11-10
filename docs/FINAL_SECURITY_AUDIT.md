# SmartLib v1.6.0 — Final Security & Dependency Audit Report

**Audit Date:** November 10, 2026  
**Auditor:** AISYS Information Security & Vulnerability Assessment Team  
**Scope:** Authentication, RBAC, Secret Exposure, Injection Defense, Dependency SBOM, and Data Privacy

---

## 1. Authentication & Session Management

- **Password Hashing:** Passwords are never stored in plaintext. Passwords are salted and hashed using `bcryptjs` with cost factor 10.
- **JWT Architecture:**
  - Token algorithm: HMAC-SHA256 (`HS256`).
  - Access token expiry: Configurable (`15m` default).
  - Refresh token expiry: Configurable (`7d` default).
  - Tokens encode minimal claims: `userId`, `email`, `role`, and granular `permissions[]`.
- **Session Termination:** Client clears both `smartlib_token` and `smartlib_user` from `localStorage` upon logout. API responses on `401 Unauthorized` trigger automatic redirection to `/login`.

---

## 2. Role-Based Access Control (RBAC) & Principle of Least Privilege

The application enforces 5 hierarchical user roles:
1. `ADMIN`: Full institutional authority, user/role provisioning, policy modifications, backup/restore, and compliance audit trail inspection (`/audit`).
2. `LIBRARIAN`: Cataloguing, accessioning, purchase order receiving, circulation management, fine waivers, and reporting.
3. `STAFF`: Day-to-day circulation desk issue, return, renewal, and fine collection.
4. `RFID_OPERATOR`: Hardware encoding, tag binding, antenna diagnostics, and handheld shelf sweeps.
5. `PATRON`: Self-service catalog discovery, due-date enquiry, and virtual bookshelf.

### Enforcement Evidence:
- **Backend Middleware:** `requireRole(['ADMIN'])` guards `/api/v1/audit-logs`, `/api/v1/system/users`, `/api/v1/system/backup`, and `/api/v1/settings`. Access attempts by unauthorized roles strictly return `403 Forbidden` (verified in `tests/rbac.test.ts`).
- **Frontend Guards:** `ProtectedRoute.tsx` verifies role claims before rendering routes and navigates to the redesigned `UnauthorizedPage` on access denials.

---

## 3. Secret Scanning & Git Hygiene

A recursive regex scan across all project files (`*.ts`, `*.tsx`, `*.py`, `*.md`, `*.json`, `*.yml`, `*.ps1`) verified:
- **Gitignore Protection:** `.env`, `.env.local`, `*.sqlite`, `*.db`, and `data/*.db` are strictly excluded in `.gitignore`.
- **Committed Secrets:** Zero active Neon database connection strings, database passwords, or JWT secrets are committed to git-tracked files.
- **Example Templates:** `.env.example` templates contain standard redacted placeholders (e.g., `postgresql://[username]:[password]@[host]/neondb`).
- **Test Fixtures:** Unit tests assert regex structure or use mock tokens rather than hardcoded production credentials.

---

## 4. Injection Defenses & Data Sanitization

1. **SQL Injection:**
   - Mitigated natively by Prisma ORM using parameterized queries. Raw queries in system diagnostics use strict tagged template literals (`prisma.$queryRaw\`SELECT 1\``).
2. **Cross-Site Scripting (XSS):**
   - React 19 JSX automatically escapes rendered strings.
   - Helmet middleware (`helmet()`) sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and strict referer policies.
3. **Spreadsheet Formula Injection (CSV Injection):**
   - Verified in `reports.service.ts` and test `phase4d-reports.test.ts` (Test 13).
   - Any cell starting with `=, +, -, @` is automatically escaped with a leading apostrophe (`'`) to prevent formula execution in Microsoft Excel or Google Sheets.
4. **Input Schema Validation:**
   - Every API endpoint is guarded by a Zod schema validating input types, ranges, email formats, and string lengths before reaching controller logic.

---

## 5. Public OPAC Privacy & Zero PII Leakage

- **Route:** `/opac` is accessible without authentication.
- **Zero Patron PII:** OPAC endpoints return exclusively bibliographic title data, call numbers, shelf locations, and aggregated copy availability counts (`availableCopies: number`). Member names, borrowing histories, and contact numbers are strictly inaccessible from `/api/v1/opac/*`.
- **Virtual Bookshelf Isolation:** Patron reading lists require authenticated JWTs and enforce user isolation (`GET /api/v1/opac/bookshelf/personal?userId=...` strictly forbids reading another user's bookshelf).

---

## 6. Software Bill of Materials (SBOM) & Dependencies

- **SBOM Standard:** CycloneDX v1.5 JSON formatted (`docs/sbom-cyclonedx-1.5.json`).
- **Node.js Dependencies:** Managed and pinned via `package-lock.json` in both `backend` and `frontend`.
- **Python Dependencies:** Pinned in `rfid-service/requirements.txt`.
- **Licensing:** All libraries are open-source with permissive commercial licenses (MIT, Apache 2.0, BSD-3-Clause). No copyleft GPL-3.0 contaminations exist in production runtime dependencies.

