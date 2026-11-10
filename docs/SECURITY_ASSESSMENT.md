# SmartLib — Security Architecture & Threat Assessment

**Security Engineer:** Lead Security Architect  
**Evaluation Standard:** OWASP Top 10 API Security / Institutional Data Protection  
**Date:** 2026-11-06

---

## 1. Security Controls & Evaluation Summary

| Security Domain | Control Implementation | Assessment | Status |
|---|---|---|---|
| **Authentication** | JWT Bearer tokens with short-lived access (`15m`) and rotating refresh tokens (`7d`). | Verified. Tampered tokens rejected with HTTP 401. | **PASS** |
| **Password Hashing** | Bcrypt with salt rounds = 10 (`bcryptjs`). Plaintext passwords never stored. | Verified in `auth.service.ts` and `seed.ts`. | **PASS** |
| **Authorization (RBAC)** | Route middleware enforcing role hierarchies (`ADMIN`, `LIBRARIAN`, `RFID_OPERATOR`). | Verified. Librarian forbidden from `/audit-logs` (HTTP 403). | **PASS** |
| **SQL Injection** | Prisma ORM utilizes parameterized queries exclusively. | Verified. No raw SQL query string interpolation found. | **PASS** |
| **Input Validation** | Zod schemas validate request bodies before controllers execute. | Verified. Malformed requests rejected with HTTP 400. | **PASS** |
| **HTTP Security Headers** | Helmet middleware configured on Express app (`Content-Security-Policy`, etc.). | Verified in `app.ts`. | **PASS** |
| **Cross-Origin Policy** | CORS restricted to configured whitelist origins (`ALLOWED_ORIGINS`). | Verified in `app.ts` and `config/env.ts`. | **PASS** |
| **Secrets Management** | Neon connection strings and JWT secrets isolated in `.env`. Zero secrets in git. | Verified. `.env` listed in `.gitignore`. | **PASS** |
| **Audit Log Integrity** | Chronological audit logs recording actor, action, entity, IP, and timestamp. | Verified in `AuditLog` table and `/api/v1/audit-logs`. | **PASS** |
| **RFID Buffer Tampering** | SQLite edge buffer operates in WAL mode with local integrity constraints. | Verified in `rfid-service/buffer/offline_sync.py`. | **PASS** |

---

## 2. Vulnerability & Hardening Findings

### High Severity: None Detected
No remote code execution, SQL injection, authentication bypass, or privilege escalation vectors were found in existing endpoints.

### Medium Severity: Rate Limiting
- **Observation:** Express currently lacks an IP-based request rate limiter (e.g. `express-rate-limit`) on the `/api/v1/auth/login` endpoint.
- **Risk:** Potential brute-force vulnerability against staff credentials if exposed to public networks.
- **Remediation:** Add `express-rate-limit` (10 requests per minute per IP) to the auth router prior to open public production rollout.

### Low Severity: Session Invalidation
- **Observation:** Logout clears tokens from frontend `localStorage`, but backend JWT tokens are not added to a distributed blocklist (e.g. Redis) before natural expiry.
- **Remediation:** Acceptable for institutional LAN deployment with 15-minute access token lifespan. For multi-campus WAN, deploy Redis token revocation list.

