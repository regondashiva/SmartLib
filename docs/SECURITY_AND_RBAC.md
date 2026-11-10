# SmartLib v1.6.0 — Security & RBAC Documentation

**Document ID:** `SMARTLIB-SECURITY-RBAC-v1.6.0`  
**System:** SmartLib Integrated Library Management System  
**Audit & Closure Date:** November 10, 2026  
**Security Standard:** Principle of Least Privilege & OWASP Top 10 Mitigation  

---

## 1. Authentication Architecture

SmartLib enforces state-of-the-art authentication mechanisms across all endpoints:

1. **Password Hashing**: Passwords are never stored in cleartext. Salting and hashing are performed using `bcryptjs` with a work cost factor of 10.
2. **JSON Web Tokens (JWT)**:
   - Signature Algorithm: HMAC-SHA256 (`HS256`).
   - Token Lifecycle: 15-minute access token lifespan with refresh token renewal.
   - Minimal Claims: Tokens encode strictly non-sensitive claims (`userId`, `email`, `role`, and `permissions`).
   - Secret Validation: Minimum 32-character high-entropy secret validated by Zod at server startup.
3. **Session Hygiene**: Client-side authentication context clears cached tokens on logout. Any expired or tampered token returns `401 Unauthorized` and triggers route redirection to `/login`.

---

## 2. Role-Based Access Control (RBAC) Matrix

SmartLib defines 4 operational staff roles and a patron role, strictly enforced at the Express middleware layer (`requireRole(...)` and `requirePermission(...)`):

| Module / Resource | API Route Prefix | `ADMIN` | `LIBRARIAN` | `RFID_OPERATOR` | `STUDENT` / Patron | Public |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Public OPAC Search** | `GET /api/v1/opac/*` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| **Virtual Bookshelf** | `GET/POST /api/v1/opac/bookshelf/*` | ALLOW | ALLOW | ALLOW | ALLOW | DENY |
| **Catalog Viewing** | `GET /api/v1/books/*` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| **Cataloguing & Accession** | `POST/PUT /api/v1/books/*` | ALLOW | ALLOW | DENY (403) | DENY (403) | DENY (401) |
| **Circulation Issue / Return**| `POST /api/v1/circulation/*` | ALLOW | ALLOW | DENY (403) | DENY (403) | DENY (401) |
| **Fine Collection & Waiver** | `POST /api/v1/circulation/fines/*` | ALLOW | ALLOW | DENY (403) | DENY (403) | DENY (401) |
| **Patron / Member Management**| `GET/POST/PATCH /api/v1/members/*`| ALLOW | ALLOW | DENY (403) | DENY (403) | DENY (401) |
| **RFID Tag Commissioning** | `POST /api/v1/rfid/tags/*` | ALLOW | ALLOW | ALLOW | DENY (403) | DENY (401) |
| **RFID Inventory Sweeps** | `POST /api/v1/rfid/inventory/*` | ALLOW | ALLOW | ALLOW | DENY (403) | DENY (401) |
| **Security Gate Monitoring** | `GET/POST /api/v1/rfid/gate/*` | ALLOW | ALLOW | ALLOW | DENY (403) | DENY (401) |
| **Reports & BI Export** | `GET /api/v1/reports/*` | ALLOW | ALLOW | DENY (403) | DENY (403) | DENY (401) |
| **Data Migration Console** | `POST /api/v1/migration/*` | ALLOW | DENY (403) | DENY (403) | DENY (403) | DENY (401) |
| **Audit Compliance Logs** | `GET /api/v1/audit-logs` | ALLOW | DENY (403) | DENY (403) | DENY (403) | DENY (401) |
| **System Settings & Policies**| `PATCH /api/v1/settings` | ALLOW | DENY (403) | DENY (403) | DENY (403) | DENY (401) |
| **Database Backup & Restore** | `POST /api/v1/system/backup` | ALLOW | DENY (403) | DENY (403) | DENY (403) | DENY (401) |

---

## 3. Threat Mitigation & Defensive Engineering

1. **SQL Injection Defense**: 100% of database access is mediated through Prisma ORM parameterized queries. Raw queries in system diagnostic checks utilize strict tagged template literals (`prisma.$queryRaw\SELECT 1\`).
2. **Cross-Site Scripting (XSS)**: React 18 JSX engine escapes untrusted strings by default. Helmet HTTP security headers enforce `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and strict referer policies.
3. **Spreadsheet Formula Injection (CSV Injection)**: In `reports.service.ts`, all exported CSV cells starting with formula trigger characters (`=`, `+`, `-`, `@`) are automatically sanitized with a leading single quote (`'`), preventing formula execution when opened in Excel.
4. **Input Validation**: Every incoming request payload is validated against strict Zod schemas before hitting business logic. Type violations return formatted `400 Bad Request` envelopes.
5. **Rate Limiting**: Express rate limiting protects sensitive endpoints (`/api/v1/auth/login`) against credential brute-forcing.

---

## 4. Secret Hygiene & Compliance Verification

- **Git Secret Exclusion**: `.gitignore` strictly excludes `.env`, `*.db`, `*.sqlite`, and deployment tokens.
- **Credential Masking**: All logs and error envelopes redact database credentials, connection strings, and authorization tokens.
- **Verification Evidence**:
  - `backend/tests/rbac.test.ts`: **3/3 PASS** (Verified Librarian blocked from `/audit-logs` with 403; Admin permitted with 200).
  - `backend/tests/auth.test.ts`: **6/6 PASS** (Verified password rejection, invalid token rejection, profile fetch).

