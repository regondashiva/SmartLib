# SmartLib v1.6.0 — Test Database Isolation Guide

## 1. Overview & Architecture

Automated testing in the SmartLib Enterprise Library Management System operates under a strict **Zero-Downtime & Data-Preservation Principle**. Automated integration tests exercise real database operations via Prisma ORM against PostgreSQL without destroying development datasets, seed accounts, catalog records, or system configuration.

```
                  ┌────────────────────────────────────────┐
                  │             Node.js Runtime            │
                  │         NODE_ENV = 'test' | 'dev'      │
                  └───────────────────┬────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │ src/config/prisma.ts    │
                         └────────────┬────────────┘
                                      │
             ┌────────────────────────┴────────────────────────┐
             ▼                                                 ▼
   [NODE_ENV === 'test' &&                             [Standard Dev / Prod]
    TEST_DATABASE_URL defined]                                 │
             │                                                 │
             ▼                                                 ▼
┌───────────────────────────┐                     ┌───────────────────────────┐
│ Isolated Test PostgreSQL  │                     │ Primary Development DB    │
│ (TEST_DATABASE_URL)       │                     │ (DATABASE_URL)            │
│ Neon Branch / Local Docker│                     │ Cloud Neon PostgreSQL     │
└───────────────────────────┘                     └───────────────────────────┘
```

---

## 2. Configuration & Environment Variables

### 2.1 Supported Environment Variables

| Variable | Required | Context | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | Dev, Test, Prod | Primary PostgreSQL connection string used by the application server. |
| `TEST_DATABASE_URL` | **Optional** | Test (`NODE_ENV=test`) | Dedicated PostgreSQL connection string for test execution. When omitted, tests execute safely against `DATABASE_URL` using isolated namespaces. |
| `NODE_ENV` | **Yes** | Global | Environment mode (`development`, `test`, `production`). |

### 2.2 Environment Schema Validation (`backend/src/config/env.ts`)

The Zod environment schema cleanly defines and validates `TEST_DATABASE_URL`:

```typescript
// backend/src/config/env.ts
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().url('Valid PostgreSQL connection URL is required'),
  TEST_DATABASE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
});
```

### 2.3 Dynamic Datasource Switching (`backend/src/config/prisma.ts`)

Prisma Client dynamically redirects queries to the dedicated test database when running in test mode:

```typescript
// backend/src/config/prisma.ts
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

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
```

---

## 3. Dedicated Test Database Setup Options

### Option A: Cloud Neon PostgreSQL Branch (Recommended for CI/CD)

Neon serverless PostgreSQL supports instant, zero-copy database branching. Developers and CI pipelines can create an isolated ephemeral test branch:

```bash
# 1. Create an ephemeral branch for testing
neonctl branches create --name test-ci-run

# 2. Export connection string (never commit credentials)
export TEST_DATABASE_URL="postgresql://user:pass@ep-test-branch.neon.tech/neondb?sslmode=require"

# 3. Push schema to test branch
npx prisma db push --schema=backend/prisma/schema.prisma

# 4. Run test suite against test branch
npm --prefix backend test
```

### Option B: Local Docker PostgreSQL Instance (Offline / Local Dev)

For local offline development:

```bash
# 1. Start local PostgreSQL container
docker run --name smartlib-test-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=smartlib_test -p 5433:5432 -d postgres:16-alpine

# 2. Set TEST_DATABASE_URL in backend/.env.test
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/smartlib_test?schema=public"

# 3. Apply schema migrations
DATABASE_URL=$TEST_DATABASE_URL npx prisma db push

# 4. Execute test suite
npm --prefix backend test
```

---

## 4. Non-Destructive Testing Rules & Cleanup Hygiene

When testing against shared or development databases without `TEST_DATABASE_URL`:

1. **Never TRUNCATE or DROP tables**: Automated test hooks must NEVER issue `TRUNCATE TABLE`, `DROP SCHEMA`, or `DELETE FROM` without an explicit entity ID filter.
2. **Explicit Entity Tracking**: Every test suite must track primary keys of created records (e.g., `testBatchIds`, `testBookId`, `testMemberId`, `gateEventIds`).
3. **Idempotent Teardown Hooks**: All cleanup routines in `afterAll` or `afterEach` must be wrapped in `try { ... } catch {}` blocks to prevent secondary test runner failures.
4. **Collision-Free Business Keys**: Never hardcode ISBNs, Card Numbers, Accession Numbers, Barcodes, or EPCs. Use the generators detailed in the [Test Fixture Guide](./TEST_FIXTURE_AND_UNIQUE_DATA_GUIDE.md).
5. **Isolated Test Patrons**: Never borrow against existing active members whose borrowing limit might be saturated by parallel or previous tests. Always instantiate a dedicated test patron per suite and delete it upon completion.

---

## 5. Active Database Findings & Documented Limitation

- **Target Database Host**: `ep-noisy-dream-bd6bdm2n-pooler.c-8.us-east-2.aws.neon.tech`
- **Target Database Name**: `/neondb`
- **Current Limitation**: Repeatability runs currently execute against the primary development Neon database over the public Internet. While baseline records (`users: 7, roles: 4, books >= 29, members >= 8`) remain completely intact through non-destructive entity isolation, cross-continental TCP network latency occasionally causes remote connection drops (`Prisma P1001`). Provisioning a dedicated local Docker test database (`TEST_DATABASE_URL`) is strongly recommended for production CI/CD pipelines.
