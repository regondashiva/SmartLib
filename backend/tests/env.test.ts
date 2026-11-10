import { describe, it, expect } from 'vitest';
import { env } from '../src/config/env.js';

describe('Environment Configuration Validation', () => {
  it('should load and validate required environment variables', () => {
    expect(env).toBeDefined();
    expect(env.PORT).toBeTypeOf('number');
    expect(env.NODE_ENV).toBeDefined();
    expect(env.DATABASE_URL).toContain('neon.tech');
    expect(env.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(16);
    expect(env.JWT_REFRESH_SECRET.length).toBeGreaterThanOrEqual(16);
  });

  it('should apply default values for optional configurations', () => {
    expect(env.API_PREFIX).toBe('/api/v1');
    expect(env.JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(env.JWT_REFRESH_EXPIRES_IN).toBe('7d');
    expect(env.MOCK_RFID_MODE).toBe(true);
  });
});

