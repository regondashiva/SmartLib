import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Reuse PrismaClient instance in development to avoid exhausting connections
export const prisma =
  globalThis.__prisma ||
  new PrismaClient({
    datasources:
      process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL
        ? { db: { url: process.env.TEST_DATABASE_URL } }
        : undefined,
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

