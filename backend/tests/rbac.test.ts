import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Role-Based Access Control (RBAC) Enforcement', () => {
  let librarianToken: string;
  let adminToken: string;

  it('should authenticate both Librarian and Admin seeded accounts', async () => {
    // 1. Authenticate Librarian
    const libRes = await request(app).post('/api/v1/auth/login').send({
      email: 'librarian@smartlib.institution.edu',
      password: 'LibrarianPassword123!',
    });
    expect(libRes.status).toBe(200);
    expect(libRes.body.data.user.role).toBe('LIBRARIAN');
    librarianToken = libRes.body.data.tokens.accessToken;

    // 2. Authenticate Admin
    const adminRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@smartlib.institution.edu',
      password: 'AdminPassword123!',
    });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.user.role).toBe('ADMIN');
    adminToken = adminRes.body.data.tokens.accessToken;
  });

  it('should deny access (403 Forbidden) when Librarian attempts to access Admin-only /api/v1/audit-logs', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${librarianToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Role 'LIBRARIAN' is not authorized");
  });

  it('should allow access (200 OK) when Admin accesses /api/v1/audit-logs', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

