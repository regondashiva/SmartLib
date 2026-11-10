import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Authentication Module (/api/v1/auth)', () => {
  let adminToken: string;

  it('should successfully authenticate seeded Admin user and return JWT tokens', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@smartlib.institution.edu',
      password: 'AdminPassword123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('admin@smartlib.institution.edu');
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
    expect(res.body.data.tokens.tokenType).toBe('Bearer');

    adminToken = res.body.data.tokens.accessToken;
  });

  it('should reject login attempt with incorrect password (401)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@smartlib.institution.edu',
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid institutional email or password');
  });

  it('should reject login for non-existent user email (401)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'ghost.user@institution.edu',
      password: 'SomePassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid institutional email or password');
  });

  it('should return current user profile on GET /api/v1/auth/me with valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('admin@smartlib.institution.edu');
    expect(res.body.data.role).toBe('ADMIN');
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('should reject GET /api/v1/auth/me when token is invalid or tampered (401)', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.tampered.token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid or expired authentication token');
  });

  it('should reject GET /api/v1/auth/me when Authorization header is missing (401)', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Authentication token missing');
  });
});

