/**
 * Phase 4F — Offline Installation, Updates, Rollback & Recovery Integration Tests
 * Verifies against live Neon PostgreSQL database via Prisma:
 *
 *  Package Management & Integrity:
 *   1. Valid offline update package manifest validation (`POST /api/v1/system/packages/validate`)
 *   2. Rejects corrupted package with SHA-256 checksum mismatch
 *   3. Rejects invalid manifest schema and unsafe archive path traversal (`../`)
 *   4. Rejects unsupported version (downgrade via update or unmet `minSupportedUpgradeVersion`)
 *   5. Rejects missing runtime dependencies (Node.js / Python below required version or low disk space)
 *   6. Rejects destructive non-backward-compatible database migrations
 *
 *  Backup & Restore Verification:
 *   7. Creates database backup snapshot (`POST /api/v1/system/backups`), verifies file on disk & SHA-256 digest
 *   8. Verifies backup restore readiness (`POST /api/v1/system/backups/verify`) and detects tampered/corrupted backups
 *   9. Enforces explicit ADMIN confirmation (`confirmRestoreWarning: true`) before FULL_RESTORE
 *
 *  Controlled Update Lifecycle, Rollback & Recovery:
 *  10. Executes 11-step controlled update (`1.4.0` → `1.5.0`), records pre-update backup, verifies post-update health
 *  11. Automatically rolls back to last known-good version when migration or post-update health check fails
 *  12. Executes explicit administrative rollback (`POST /api/v1/system/rollback`) preserving library records
 *  13. Enforces RBAC (`ADMIN` only; `LIBRARIAN` and `STUDENT` rejected with `HTTP 403`)
 *  14. Verifies RFID SQLite offline event queue compatibility & update operation audit history (`GET /api/v1/system/history`)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { generateAccessToken } from '../src/utils/jwt.js';

async function getToken(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body?.data?.tokens?.accessToken || res.body?.data?.accessToken || '';
}

const VALID_MANIFEST_1_5_0 = {
  packageId: 'smartlib-offline-release-1.5.0',
  appVersion: '1.5.0',
  minSupportedUpgradeVersion: '1.0.0',
  buildTimestamp: '2026-11-09T14:00:00.000Z',
  components: {
    frontendVersion: '1.5.0',
    backendVersion: '1.5.0',
    rfidMiddlewareVersion: '1.3.0',
    databaseSchemaVersion: '2026.11.phase4f-v2',
  },
  requiredRuntimes: {
    nodeMinVersion: '20.0.0',
    pythonMinVersion: '3.11.0',
    postgresqlMinVersion: '15.0',
    supportedOs: ['Windows 11', 'Windows Server 2022', 'Linux x64'],
  },
  migrations: {
    requiresSchemaMigration: false,
    backwardCompatible: true,
    destructiveChanges: false,
    migrationFiles: ['0001_initial_schema.sql', '0002_phase4_indexes.sql'],
  },
  checksums: {
    frontendBundle: {
      archiveName: 'smartlib-frontend-dist-1.5.0.tar.gz',
      sha256: 'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123',
      sizeBytes: 1325000,
    },
    backendBundle: {
      archiveName: 'smartlib-backend-dist-1.5.0.tar.gz',
      sha256: 'b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef012345',
      sizeBytes: 855000,
    },
    rfidMiddlewareBundle: {
      archiveName: 'smartlib-rfid-service-1.3.0.tar.gz',
      sha256: 'c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01234567',
      sizeBytes: 420000,
    },
    databaseSchemaBundle: {
      archiveName: 'smartlib-prisma-schema-2026.11.tar.gz',
      sha256: 'd4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      sizeBytes: 39500,
    },
  },
  releaseNotes: [
    'Phase 4F controlled offline update package v1.5.0',
    'Verified pre-update PostgreSQL backup and rollback state machine',
  ],
};

let adminToken = '';
let libToken = '';
let studentToken = '';
let createdBackupId = '';

describe('Phase 4F — Offline Installation, Updates, Rollback & Recovery Suite', () => {
  beforeAll(async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    adminToken = await getToken('admin@smartlib.ac.in', 'Admin@SmartLib2026!');
    if (!adminToken) {
      adminToken = await getToken('admin@smartlib.institution.edu', 'AdminPassword123!');
    }

    const adminUser = await prisma.user.findFirst({
      where: { role: { name: 'ADMIN' }, status: 'ACTIVE' },
      include: { role: true },
    });
    expect(adminUser).toBeTruthy();

    if (!adminToken) {
      adminToken = generateAccessToken({
        userId: adminUser!.id,
        email: adminUser!.email,
        role: 'ADMIN',
        permissions: [],
      });
    }

    libToken = generateAccessToken({
      userId: adminUser!.id,
      email: adminUser!.email,
      role: 'LIBRARIAN',
      permissions: [],
    });

    studentToken = generateAccessToken({
      userId: adminUser!.id,
      email: adminUser!.email,
      role: 'STUDENT',
      permissions: ['catalog:read'],
    });

    // Ensure baseline version is 1.4.0 before starting tests
    await request(app)
      .post('/api/v1/system/rollback')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetVersion: '1.4.0',
        restoreDatabaseFromBackup: false,
        confirmDataLossWarning: false,
        reason: 'Reset baseline version to 1.4.0 before Phase 4F test suite',
      });
  }, 60000);

  afterAll(async () => {
    // Restore baseline version 1.4.0
    await request(app)
      .post('/api/v1/system/rollback')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetVersion: '1.4.0',
        restoreDatabaseFromBackup: false,
        confirmDataLossWarning: false,
        reason: 'Phase 4F test teardown: restore v1.4.0 baseline',
      });
  }, 60000);

  it('1. Retrieves current version, manifest, diagnostics, and RFID SQLite offline buffer compatibility', async () => {
    const res = await request(app)
      .get('/api/v1/system/version')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentVersion).toBe('1.4.0');
    expect(res.body.data.updateState).toBeDefined();
    expect(res.body.data.manifest).toHaveProperty('packageId');
    expect(res.body.data.diagnostics.status).toBe('HEALTHY');
    expect(res.body.data.diagnostics.rfidOfflineBuffer.available).toBe(true);
    expect(res.body.data.diagnostics.rfidOfflineBuffer.survivesUpdateAndRestart).toBe(true);
    expect(
      res.body.data.diagnostics.deploymentCapabilities.fullApplicationOfflineDatabaseMode
    ).toBe(false);
  }, 60000);

  it('2. Enforces ADMIN-only RBAC on all system update, backup, and rollback endpoints', async () => {
    const libRes = await request(app)
      .get('/api/v1/system/version')
      .set('Authorization', `Bearer ${libToken}`);
    expect(libRes.status).toBe(403);

    const studentRes = await request(app)
      .post('/api/v1/system/backups')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ label: 'Unauthorized backup attempt' });
    expect(studentRes.status).toBe(403);
  }, 60000);

  it('3. Package Management — Validates a valid offline update package manifest and matching SHA-256 checksums', async () => {
    const res = await request(app)
      .post('/api/v1/system/packages/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        manifest: VALID_MANIFEST_1_5_0,
        actualChecksums: {
          frontendBundle: VALID_MANIFEST_1_5_0.checksums.frontendBundle.sha256,
          backendBundle: VALID_MANIFEST_1_5_0.checksums.backendBundle.sha256,
          rfidMiddlewareBundle: VALID_MANIFEST_1_5_0.checksums.rfidMiddlewareBundle.sha256,
          databaseSchemaBundle: VALID_MANIFEST_1_5_0.checksums.databaseSchemaBundle.sha256,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.checks.manifestValid).toBe(true);
    expect(res.body.data.checks.checksumsVerified).toBe(true);
    expect(res.body.data.checks.versionCompatible).toBe(true);
    expect(res.body.data.checks.runtimeSupported).toBe(true);
    expect(res.body.data.checks.migrationCompatible).toBe(true);
    expect(res.body.data.checks.archivePathsSafe).toBe(true);
  }, 60000);

  it('4. Package Management — Rejects corrupted package (checksum mismatch), path traversal, unsupported versions, and missing dependencies', async () => {
    // A) Corrupted package (SHA-256 mismatch)
    const checksumMismatchRes = await request(app)
      .post('/api/v1/system/packages/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        manifest: VALID_MANIFEST_1_5_0,
        actualChecksums: {
          frontendBundle: '0000000000000000000000000000000000000000000000000000000000000000',
        },
      });
    expect(checksumMismatchRes.status).toBe(200);
    expect(checksumMismatchRes.body.data.valid).toBe(false);
    expect(checksumMismatchRes.body.data.checks.checksumsVerified).toBe(false);
    expect(
      checksumMismatchRes.body.data.issues.some((i: any) => i.code === 'CHECKSUM_MISMATCH')
    ).toBe(true);

    // B) Unsafe archive path traversal (`../`)
    const traversalManifest = {
      ...VALID_MANIFEST_1_5_0,
      checksums: {
        ...VALID_MANIFEST_1_5_0.checksums,
        frontendBundle: {
          ...VALID_MANIFEST_1_5_0.checksums.frontendBundle,
          archiveName: '../../etc/malicious.tar.gz',
        },
      },
    };
    const traversalRes = await request(app)
      .post('/api/v1/system/packages/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ manifest: traversalManifest });
    expect(traversalRes.body.data.valid).toBe(false);
    expect(traversalRes.body.data.checks.archivePathsSafe).toBe(false);

    // C) Unsupported version (minSupportedUpgradeVersion higher than installed 1.4.0)
    const unsupportedVerManifest = {
      ...VALID_MANIFEST_1_5_0,
      appVersion: '2.0.0',
      minSupportedUpgradeVersion: '1.8.0',
    };
    const verRes = await request(app)
      .post('/api/v1/system/packages/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ manifest: unsupportedVerManifest });
    expect(verRes.body.data.valid).toBe(false);
    expect(verRes.body.data.checks.versionCompatible).toBe(false);

    // D) Missing runtime dependency (Node.js below required version or insufficient disk space)
    const runtimeRes = await request(app)
      .post('/api/v1/system/packages/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        manifest: VALID_MANIFEST_1_5_0,
        simulatedRuntimeVersions: {
          nodeVersion: '18.0.0',
          pythonVersion: '3.9.0',
          freeDiskSpaceMb: 120,
        },
      });
    expect(runtimeRes.body.data.valid).toBe(false);
    expect(runtimeRes.body.data.checks.runtimeSupported).toBe(false);

    // E) Destructive non-backward-compatible migration
    const destructiveManifest = {
      ...VALID_MANIFEST_1_5_0,
      migrations: {
        requiresSchemaMigration: true,
        backwardCompatible: false,
        destructiveChanges: true,
        migrationFiles: ['0003_drop_tables.sql'],
      },
    };
    const migRes = await request(app)
      .post('/api/v1/system/packages/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ manifest: destructiveManifest });
    expect(migRes.body.data.valid).toBe(false);
    expect(migRes.body.data.checks.migrationCompatible).toBe(false);
  }, 60000);

  it('5. Backup & Restore — Creates a database backup, verifies SHA-256 on disk, and validates restore readiness', async () => {
    const createRes = await request(app)
      .post('/api/v1/system/backups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        label: 'Phase 4F Integration Test Backup',
        isKnownGood: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.backupId).toBeTruthy();
    expect(createRes.body.data.status).toBe('VERIFIED');
    expect(createRes.body.data.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(createRes.body.data.sizeBytes).toBeGreaterThan(100);
    createdBackupId = createRes.body.data.backupId;

    // Verify restore readiness (DRY_RUN_VERIFY)
    const verifyRes = await request(app)
      .post('/api/v1/system/backups/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        backupId: createdBackupId,
        mode: 'DRY_RUN_VERIFY',
        reason: 'Verify snapshot restore readiness',
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.restorable).toBe(true);
    expect(verifyRes.body.data.sha256Verified).toBe(true);

    // Verify that FULL_RESTORE without explicit confirmation is rejected with HTTP 400
    const unconfirmedRestoreRes = await request(app)
      .post('/api/v1/system/backups/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        backupId: createdBackupId,
        mode: 'FULL_RESTORE',
        confirmRestoreWarning: false,
      });
    expect(unconfirmedRestoreRes.status).toBe(400);
  }, 60000);

  it('6. Backup & Restore — Detects corrupted backup file when tampered on disk', async () => {
    const tempBackupRes = await request(app)
      .post('/api/v1/system/backups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        label: 'Tamper Detection Test Snapshot',
        isKnownGood: false,
      });
    expect(tempBackupRes.status).toBe(201);
    const tempBackupId = tempBackupRes.body.data.backupId;

    const backupFilePath = path.resolve(
      process.cwd(),
      '..',
      'data',
      'backups',
      `${tempBackupId}.json`
    );
    expect(fs.existsSync(backupFilePath)).toBe(true);

    // Tamper with the file contents on disk
    fs.appendFileSync(backupFilePath, '\n/* TAMPERED_BYTES */', 'utf8');

    const verifyTamperedRes = await request(app)
      .post('/api/v1/system/backups/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        backupId: tempBackupId,
        mode: 'DRY_RUN_VERIFY',
      });

    expect(verifyTamperedRes.status).toBe(400);
    expect(verifyTamperedRes.body.message).toMatch(/SHA-256 mismatch/i);

    // Clean up tampered file
    if (fs.existsSync(backupFilePath)) {
      fs.unlinkSync(backupFilePath);
    }
  }, 60000);

  it('7. Controlled Update Manager — Aborts safely if pre-update backup fails before applying changes', async () => {
    const failBackupRes = await request(app)
      .post('/api/v1/system/updates/execute')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        manifest: VALID_MANIFEST_1_5_0,
        reason: 'Test safe abort on backup failure',
        simulateFailureStage: 'BACKUP_FAILURE',
      });

    expect(failBackupRes.status).toBe(400);
    expect(failBackupRes.body.message).toMatch(/backup failed/i);

    // Confirm version is still 1.4.0
    const statusRes = await request(app)
      .get('/api/v1/system/version')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(statusRes.body.data.currentVersion).toBe('1.4.0');
  }, 60000);

  it('8. Controlled Update Manager — Automatically rolls back to last known-good version if post-update health check fails', async () => {
    const failedHealthUpdateRes = await request(app)
      .post('/api/v1/system/updates/execute')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        manifest: VALID_MANIFEST_1_5_0,
        reason: 'Test automatic rollback on post-update health check failure',
        simulateFailureStage: 'HEALTH_CHECK_FAILURE',
        autoRollbackOnFailure: true,
      });

    expect(failedHealthUpdateRes.status).toBe(200);
    expect(failedHealthUpdateRes.body.data.status).toBe('ROLLED_BACK');
    expect(failedHealthUpdateRes.body.data.currentVersion).toBe('1.4.0');
    expect(failedHealthUpdateRes.body.data.preUpdateBackupId).toBeTruthy();
  }, 60000);

  it('9. Controlled Update Manager — Successfully updates from v1.4.0 to v1.5.0 after pre-update backup and post-update health verification', async () => {
    const booksBefore = await prisma.book.count();
    const membersBefore = await prisma.member.count();

    const updateRes = await request(app)
      .post('/api/v1/system/updates/execute')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        manifest: VALID_MANIFEST_1_5_0,
        reason: 'Upgrade SmartLib to v1.5.0 offline release',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe('COMPLETED');
    expect(updateRes.body.data.previousVersion).toBe('1.4.0');
    expect(updateRes.body.data.currentVersion).toBe('1.5.0');
    expect(updateRes.body.data.preUpdateBackupId).toBeTruthy();

    // Verify all existing catalog and member records were preserved
    const [booksAfter, membersAfter] = await Promise.all([
      prisma.book.count(),
      prisma.member.count(),
    ]);
    expect(booksAfter).toBe(booksBefore);
    expect(membersAfter).toBe(membersBefore);
  }, 60000);

  it('10. Rollback & Recovery — Executes explicit rollback from v1.5.0 to last known-good v1.4.0 and records audit history', async () => {
    // Verify that requesting DB backup restore during rollback without confirmDataLossWarning is rejected
    const unconfirmedRollback = await request(app)
      .post('/api/v1/system/rollback')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        restoreDatabaseFromBackup: true,
        confirmDataLossWarning: false,
        reason: 'Attempt rollback with DB restore without warning confirmation',
      });
    expect(unconfirmedRollback.status).toBe(400);

    // Execute clean rollback to v1.4.0
    const rollbackRes = await request(app)
      .post('/api/v1/system/rollback')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        restoreDatabaseFromBackup: false,
        confirmDataLossWarning: false,
        reason: 'Operator rollback verification to v1.4.0',
      });

    expect(rollbackRes.status).toBe(200);
    expect(rollbackRes.body.data.status).toBe('ROLLED_BACK');
    expect(rollbackRes.body.data.rolledBackFromVersion).toBe('1.5.0');
    expect(rollbackRes.body.data.currentVersion).toBe('1.4.0');
    expect(rollbackRes.body.data.postRollbackHealth.status).toBe('HEALTHY');

    // Verify update & rollback operation history endpoint
    const historyRes = await request(app)
      .get('/api/v1/system/history?limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(historyRes.status).toBe(200);
    expect(Array.isArray(historyRes.body.data.items)).toBe(true);
    expect(historyRes.body.data.items.length).toBeGreaterThan(0);
    expect(historyRes.body.data.items[0].operation).toBe('MANUAL_ROLLBACK_EXECUTED');
  }, 60000);
});

