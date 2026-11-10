import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Zod Request Validation Middleware', () => {
  it('should return 400 when body does not match validation schema', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'not-an-email',
      password: '',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Request validation failed');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'email')).toBe(true);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'password')).toBe(true);
  });

  it('should return 400 when missing required fields completely', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Request validation failed');
  });
});

