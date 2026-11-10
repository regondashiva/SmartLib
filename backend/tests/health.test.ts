import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Health Endpoint (GET /api/v1/health)', () => {
  it('should return 200 and healthy status with live Neon database connectivity', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('HEALTHY');
    expect(res.body.data.service).toBe('smartlib-backend-engine');
    expect(res.body.data.database.provider).toBe('Neon Serverless PostgreSQL');
    expect(res.body.data.database.status).toBe('CONNECTED');
    expect(res.body.data.database.latencyMs).toBeTypeOf('number');
    expect(res.body.data.uptimeSeconds).toBeTypeOf('number');
    expect(res.body.data.memoryUsage).toBeDefined();
  });
});

