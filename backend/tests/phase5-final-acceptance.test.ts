import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { generateValidUniqueTestIsbn } from './fixtures/test-factories.js';

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
    'Phase 5 final acceptance verification offline update package v1.5.0',
  ],
};

describe('Phase 5 — Final Integration, Security, Performance & AISYS Acceptance Suite (AC01–AC10)', { timeout: 60000 }, () => {
  let adminToken = '';
  let librarianToken = '';
  let rfidOperatorToken = '';

  let testBookId = '';
  let copy1Id = '';
  let copy1Accession = '';
  let copy2Id = '';
  let copy3Id = '';
  let tag1Id = '';
  let tag2Id = '';
  let tag3Id = '';
  let testMemberId = '';
  let testMemberCardUid = '';
  let circulationId = '';
  let createdFineId = '';
  let migrationBatchId = '';
  let inventorySessionId = '';
  let gateEventIds: string[] = [];
  let createdBackupId = '';

  const suffix = Date.now().toString().slice(-8);
  const epc1 = `E2000017221101${suffix}01`;
  const epc2 = `E2000017221101${suffix}02`;
  const epc3 = `E2000017221101${suffix}03`;
  const shelfA = `STACK-P5-${suffix}-A`;
  const shelfB = `STACK-P5-${suffix}-B`;

  beforeAll(async () => {
    // 1. Wake up Neon PostgreSQL connection if suspended
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        break;
      } catch (err) {
        if (attempt === 5) throw err;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // 2. Resolve real users from DB and mint tokens
    const adminUser = await prisma.user.findFirst({
      where: { role: { name: 'ADMIN' } },
      include: { role: true },
    });
    const libUser = await prisma.user.findFirst({
      where: { role: { name: 'LIBRARIAN' } },
      include: { role: true },
    });
    const rfidUser = await prisma.user.findFirst({
      where: { role: { name: 'RFID_OPERATOR' } },
      include: { role: true },
    });

    expect(adminUser).toBeTruthy();
    adminToken = generateAccessToken({
      userId: adminUser!.id,
      email: adminUser!.email,
      role: 'ADMIN',
    });
    librarianToken = generateAccessToken({
      userId: (libUser || adminUser)!.id,
      email: (libUser || adminUser)!.email,
      role: 'LIBRARIAN',
    });
    rfidOperatorToken = generateAccessToken({
      userId: (rfidUser || adminUser)!.id,
      email: (rfidUser || adminUser)!.email,
      role: 'RFID_OPERATOR',
    });

    // 3. Create dedicated active test member with Smart Card UID
    testMemberCardUid = `SC-P5-${suffix}`;
    const createdMember = await prisma.member.create({
      data: {
        firstName: 'Phase5',
        lastName: 'AcceptancePatron',
        email: `p5.patron.${suffix}@smartlib.edu`,
        cardNumber: `MEM-P5-${suffix}`,
        smartCardUid: testMemberCardUid,
        memberType: 'STUDENT',
        status: 'ACTIVE',
        maxBorrowLimit: 5,
        fineBalance: 0,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    testMemberId = createdMember.id;
  }, 60000);

  afterAll(async () => {
    try {
      if (gateEventIds.length > 0) {
        await prisma.gateEvent.deleteMany({ where: { id: { in: gateEventIds } } });
      }
      if (inventorySessionId) {
        await prisma.inventorySession.deleteMany({ where: { id: inventorySessionId } });
      }
      if (createdFineId) {
        await prisma.fine.deleteMany({ where: { id: createdFineId } });
      }
      if (testMemberId) {
        await prisma.fine.deleteMany({ where: { memberId: testMemberId } });
        await prisma.circulation.deleteMany({ where: { memberId: testMemberId } });
      }
      if (copy1Id || copy2Id || copy3Id) {
        await prisma.bookItem.deleteMany({
          where: { id: { in: [copy1Id, copy2Id, copy3Id].filter(Boolean) } },
        });
      }
      if (tag1Id || tag2Id || tag3Id) {
        await prisma.rFIDTag.deleteMany({
          where: { id: { in: [tag1Id, tag2Id, tag3Id].filter(Boolean) } },
        });
      }
      if (testBookId) {
        await prisma.book.deleteMany({ where: { id: testBookId } });
      }
      if (testMemberId) {
        await prisma.member.deleteMany({ where: { id: testMemberId } });
      }
      if (migrationBatchId) {
        await prisma.migrationStagingRecord.deleteMany({ where: { batchId: migrationBatchId } });
        await prisma.migrationBatch.deleteMany({ where: { id: migrationBatchId } });
      }
    } catch {
      // Ignore cleanup errors
    }
  }, 60000);

  // ============================================================================
  // 1. SECURITY, RBAC, SMART CARD & RATE LIMITING (AC04, AC07)
  // ============================================================================
  it('AC04 & AC07: enforces JWT authentication, role-based access control, smart card lookup, and rate limiting', async () => {
    // Unauthenticated access blocked
    const unauthRes = await request(app).get('/api/v1/rfid/tags');
    expect(unauthRes.status).toBe(401);

    // RFID_OPERATOR blocked from ADMIN settings mutation
    const forbiddenSettings = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${rfidOperatorToken}`)
      .send({ circulation: { maxRenewals: 5 } });
    expect(forbiddenSettings.status).toBe(403);

    // LIBRARIAN allowed read-only settings access
    const libReadSettings = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(libReadSettings.status).toBe(200);

    // AC07: Smart Card UID lookup resolves member record and borrowing eligibility
    const cardRes = await request(app)
      .get(`/api/v1/members/card/${testMemberCardUid}`)
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(cardRes.status).toBe(200);
    expect(cardRes.body.data.id).toBe(testMemberId);
    expect(cardRes.body.data.smartCardUid).toBe(testMemberCardUid);

    // Rate-limit enforcement verification on /api/v1/auth/login
    const testIp = `10.255.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    let lastStatus = 200;
    for (let i = 0; i < 16; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', testIp)
        .set('x-enforce-rate-limit', 'true')
        .send({ email: 'nobody@smartlib.edu', password: 'WrongPassword' });
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  // ============================================================================
  // 2. WORKFLOW A — CATALOGUING, RFID TAGGING (AC02) & CIRCULATION (AC03)
  // ============================================================================
  it('Workflow A (AC02 & AC03): creates book + copies, assigns RFID tags with duplicate protection, issues, renews, returns with overdue fine, and settles fine', async () => {
    const validIsbn = generateValidUniqueTestIsbn();
    // 1. Create bibliographic record with 3 physical copies
    const bookRes = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: `Phase 5 Acceptance Verification Architecture ${suffix}`,
        subtitle: 'End-to-End AISYS Verification',
        isbn13: validIsbn,
        edition: '1st Edition',
        publicationYear: 2026,
        callNumber: `005.133 P5-${suffix}`,
        language: 'English',
        pageCount: 380,
        publisherName: 'SmartLib Institutional Press',
        categoryName: 'Computer Science',
        authors: ['Dr. A. Verification'],
        copiesCount: 3,
        shelfLocation: shelfA,
        isReferenceOnly: false,
        price: 950.0,
      });

    expect(bookRes.status).toBe(201);
    testBookId = bookRes.body.data.id;
    const copies = bookRes.body.data.copies;
    expect(copies).toHaveLength(3);

    copy1Id = copies[0].id;
    copy1Accession = copies[0].accessionNumber;
    copy2Id = copies[1].id;
    copy3Id = copies[2].id;

    // Move Copy 2 to shelfB so we can test misplaced detection in Workflow C
    await prisma.bookItem.update({
      where: { id: copy2Id },
      data: { shelfLocation: shelfB },
    });

    // 2. Assign RFID tags (AC02)
    const tag1Res = await request(app)
      .post('/api/v1/rfid/tags')
      .set('Authorization', `Bearer ${rfidOperatorToken}`)
      .send({
        epc: epc1,
        bookItemId: copy1Id,
        easArmed: true,
      });
    expect(tag1Res.status).toBe(201);
    expect(tag1Res.body.data.tag.status).toBe('ACTIVE');
    expect(tag1Res.body.data.tag.easArmed).toBe(true);
    tag1Id = tag1Res.body.data.tag.id;

    const tag2Res = await request(app)
      .post('/api/v1/rfid/tags')
      .set('Authorization', `Bearer ${rfidOperatorToken}`)
      .send({
        epc: epc2,
        bookItemId: copy2Id,
        easArmed: true,
      });
    expect(tag2Res.status).toBe(201);
    tag2Id = tag2Res.body.data.tag.id;

    const tag3Res = await request(app)
      .post('/api/v1/rfid/tags')
      .set('Authorization', `Bearer ${rfidOperatorToken}`)
      .send({
        epc: epc3,
        bookItemId: copy3Id,
        easArmed: true,
      });
    expect(tag3Res.status).toBe(201);
    tag3Id = tag3Res.body.data.tag.id;

    // 3. Verify duplicate EPC prevention (AC02)
    const dupEpcRes = await request(app)
      .post('/api/v1/rfid/tags')
      .set('Authorization', `Bearer ${rfidOperatorToken}`)
      .send({ epc: epc1 });
    expect(dupEpcRes.status).toBe(409);

    // 4. Verify EPC lookup used by Python RFID middleware
    const lookupRes = await request(app)
      .get(`/api/v1/rfid/tags?epc=${epc1}&limit=1`)
      .set('Authorization', `Bearer ${rfidOperatorToken}`);
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.data.length).toBe(1);
    expect(lookupRes.body.data[0].associatedItem.accessionNumber).toBe(copy1Accession);

    // 5. Issue Copy 1 to active student member (AC03)
    const issueRes = await request(app)
      .post('/api/v1/circulation/issue')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        memberId: testMemberId,
        bookItemId: copy1Id,
      });
    expect(issueRes.status).toBe(201);
    circulationId = issueRes.body.data.id || issueRes.body.data.circulation?.id;
    expect(circulationId).toBeTruthy();

    // Verify tag EAS is disarmed in DB
    const tagAfterIssue = await prisma.rFIDTag.findUnique({ where: { id: tag1Id } });
    expect(tagAfterIssue?.easArmed).toBe(false);

    // 6. Renew active loan
    const renewRes = await request(app)
      .post('/api/v1/circulation/renew')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ circulationId });
    expect(renewRes.status).toBe(200);

    const afterRenew = await prisma.circulation.findUnique({ where: { id: circulationId } });
    expect(afterRenew?.renewalCount).toBe(1);

    // 7. Backdate dueDate by 3 days to verify overdue fine calculation on return
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.circulation.update({
      where: { id: circulationId },
      data: { dueDate: threeDaysAgo },
    });

    const returnRes = await request(app)
      .post('/api/v1/circulation/return')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ circulationId });
    expect(returnRes.status).toBe(200);

    // Verify EAS re-armed
    const tagAfterReturn = await prisma.rFIDTag.findUnique({ where: { id: tag1Id } });
    expect(tagAfterReturn?.easArmed).toBe(true);

    // Verify fine created
    const fineObj = returnRes.body.data.fine || returnRes.body.data.fineCreated;
    expect(fineObj).toBeTruthy();
    createdFineId = fineObj.id;
    const fineAmount = Number(fineObj.amount);
    expect(fineAmount).toBeGreaterThan(0);

    // 8. Pay overdue fine and verify balance returns to 0
    const payRes = await request(app)
      .post('/api/v1/circulation/fines/pay')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ fineId: createdFineId, amount: fineAmount, paymentMethod: 'CASH' });
    expect(payRes.status).toBe(200);

    const paidFine = await prisma.fine.findUnique({ where: { id: createdFineId } });
    expect(paidFine?.status).toBe('PAID');
    expect(Number(paidFine?.balance)).toBe(0);
  });

  // ============================================================================
  // 3. WORKFLOW B — DATA MIGRATION LIFECYCLE (AC01)
  // ============================================================================
  it('Workflow B (AC01): uploads CSV batch, validates duplicates/errors, runs dry-run, commits valid records, and safely rolls back', async () => {
    const migIsbn = generateValidUniqueTestIsbn();
    const missingTitleIsbn = generateValidUniqueTestIsbn();
    const migAcc = `ACC-MIG-${suffix}`;
    const csvContent = [
      'title,isbn,author,publisher,category,year,shelf,copies,accessionNumber',
      `Phase 5 Migrated Book ${suffix},${migIsbn},Dr. Migration,Academic Press,Computer Science,2024,STACK-M1,1,${migAcc}`,
      `Duplicate Row Book,${migIsbn},Dr. Migration,Academic Press,Computer Science,2024,STACK-M1,1,${migAcc}`,
      `,${missingTitleIsbn},Missing Title Author,Academic Press,Computer Science,2024,STACK-M1,1,ACC-ERR-${suffix}`,
    ].join('\n');

    // 1. Upload CSV via multipart attachment
    const uploadRes = await request(app)
      .post('/api/v1/migrations/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from(csvContent, 'utf-8'), `phase5_${suffix}.csv`);

    expect(uploadRes.status).toBe(201);
    migrationBatchId = uploadRes.body.data.batchId || uploadRes.body.data.batch?.id;
    expect(migrationBatchId).toBeTruthy();
    expect(uploadRes.body.data.totalRecords).toBe(3);

    // 2. Validate
    const validateRes = await request(app)
      .post(`/api/v1/migrations/${migrationBatchId}/validate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.data.validRecords).toBe(1);
    expect(validateRes.body.data.errorRecords).toBe(2);

    // 3. Dry-Run
    const dryRunRes = await request(app)
      .post(`/api/v1/migrations/${migrationBatchId}/dry-run`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.data.status).toBe('DRY_RUN_COMPLETED');

    // 4. Commit valid rows
    const commitRes = await request(app)
      .post(`/api/v1/migrations/${migrationBatchId}/commit`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(commitRes.status).toBe(200);
    expect(commitRes.body.data.status).toBe('COMMITTED');

    const committedBook = await prisma.book.findUnique({ where: { isbn13: migIsbn } });
    expect(committedBook).toBeTruthy();

    // 5. Safe Rollback
    const rollbackRes = await request(app)
      .post(`/api/v1/migrations/${migrationBatchId}/rollback`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(rollbackRes.status).toBe(200);
    expect(rollbackRes.body.data.status).toBe('ROLLED_BACK');

    const rolledBackBook = await prisma.book.findUnique({ where: { isbn13: migIsbn } });
    expect(rolledBackBook).toBeNull();
  });

  // ============================================================================
  // 4. WORKFLOW C — HANDHELD RFID INVENTORY & RECONCILIATION (AC05)
  // ============================================================================
  it('Workflow C (AC05): reconciles handheld RFID shelf sweep with duplicate deduplication, verified, misplaced, missing, and uncataloged detection', async () => {
    // On shelfA we expect copy1 (epc1) and copy3 (epc3).
    // copy2 (epc2) belongs to shelfB.
    // We scan: epc1 twice (duplicate scan), epc2 (misplaced from shelfB), and an unknown EPC.
    // We omit epc3 so copy3 is detected as MISSING.
    const unknownEpc = `E2000017221199${suffix}FF`;

    const invRes = await request(app)
      .post('/api/v1/rfid/inventory-sessions')
      .set('Authorization', `Bearer ${rfidOperatorToken}`)
      .send({
        targetLocation: shelfA,
        scannedEpcs: [epc1, epc1, epc2, unknownEpc],
      });

    expect(invRes.status).toBe(201);
    inventorySessionId = invRes.body.data.id;

    const summary = invRes.body.data.summary;
    expect(summary.rawScanCount).toBe(4);
    expect(summary.uniqueScannedCount).toBe(3);
    expect(summary.duplicateScanCount).toBe(1);
    expect(summary.totalVerified).toBe(1);
    expect(summary.totalMisplaced).toBe(1);
    expect(summary.totalMissing).toBe(1);
    expect(summary.totalUncataloged).toBe(1);
  });

  // ============================================================================
  // 5. WORKFLOW D — SECURITY GATE & CCTV CORRELATION (AC06)
  // ============================================================================
  it('Workflow D (AC06): validates EAS bit at security gate, logs authorized passage vs unauthorized alarm with CCTV reference', async () => {
    // Copy 1 currently has easArmed = true (returned in Workflow A)
    // Simulate unauthorized exit (easArmed = true -> alarmTriggered = true)
    const alarmRes = await request(app)
      .post('/api/v1/rfid/gate-events')
      .set('Authorization', `Bearer ${rfidOperatorToken}`)
      .send({
        tagEpc: epc1,
        footfallCount: 1,
      });

    expect(alarmRes.status).toBe(201);
    gateEventIds.push(alarmRes.body.data.id);
    expect(alarmRes.body.data.alarmTriggered).toBe(true);
    expect(alarmRes.body.data.easArmed).toBe(true);
    expect(alarmRes.body.data.cctvTimestampRef).toContain('CAM-GATE-01_');
    expect(alarmRes.body.data.hardwareMode).toBe('MOCK_EMULATOR');

    // Simulate authorized exit (EAS disarmed)
    await prisma.rFIDTag.update({ where: { id: tag2Id }, data: { easArmed: false } });
    const passRes = await request(app)
      .post('/api/v1/rfid/gate-events')
      .set('Authorization', `Bearer ${rfidOperatorToken}`)
      .send({
        tagEpc: epc2,
        footfallCount: 1,
      });
    expect(passRes.status).toBe(201);
    gateEventIds.push(passRes.body.data.id);
    expect(passRes.body.data.alarmTriggered).toBe(false);
    await prisma.rFIDTag.update({ where: { id: tag2Id }, data: { easArmed: true } });
  });

  // ============================================================================
  // 6. WORKFLOW E & F — REPORTS (AC08) + OFFLINE PACKAGE, BACKUP & ROLLBACK (AC09, AC10)
  // ============================================================================
  it('Workflow E & F (AC08, AC09, AC10): verifies live reports/exports, creates verified backup, validates offline package, and auto-rolls back failed update', async () => {
    // AC08: Dashboard & exports
    const dashRes = await request(app)
      .get('/api/v1/reports/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.catalog.totalPhysicalCopies).toBeGreaterThan(0);

    const csvExport = await request(app)
      .get('/api/v1/reports/export/csv?type=SECURITY_GATES')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(csvExport.status).toBe(200);
    expect(csvExport.headers['content-type']).toContain('text/csv');

    // AC10: Create backup, verify checksum, and test isolated dry-run restore
    const backupRes = await request(app)
      .post('/api/v1/system/backups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'phase5-acceptance-snapshot', isKnownGood: true });
    expect(backupRes.status).toBe(201);
    createdBackupId = backupRes.body.data.backupId;
    expect(createdBackupId).toBeTruthy();

    const verifyRes = await request(app)
      .post('/api/v1/system/backups/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        backupId: createdBackupId,
        mode: 'DRY_RUN_VERIFY',
        reason: 'Phase 5 Acceptance Restore Verification',
      });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.restorable).toBe(true);
    expect(verifyRes.body.data.sha256Verified).toBe(true);

    // AC09: Validate update package & verify simulated failure triggers automatic rollback
    const validatePkg = await request(app)
      .post('/api/v1/system/packages/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ manifest: VALID_MANIFEST_1_5_0 });
    expect(validatePkg.status).toBe(200);
    expect(validatePkg.body.data.valid).toBe(true);

    const failedUpdate = await request(app)
      .post('/api/v1/system/updates/execute')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        manifest: VALID_MANIFEST_1_5_0,
        reason: 'Phase 5 Acceptance Simulated Failure Rollback Check',
        simulateFailureStage: 'HEALTH_CHECK_FAILURE',
        autoRollbackOnFailure: true,
      });
    expect(failedUpdate.status).toBe(200);
    expect(failedUpdate.body.data.status).toBe('ROLLED_BACK');
  });

  // ============================================================================
  // 7. DATA INTEGRITY INVARIANTS & PERFORMANCE BENCHMARKS
  // ============================================================================
  it('verifies zero duplicate accession numbers, zero duplicate RFID EPCs, zero negative fine balances, and sub-5s integrity query latency', async () => {
    const start = Date.now();
    const [dupAccessions, dupEpcs, negativeFines] = await Promise.all([
      prisma.$queryRaw<Array<{ accessionNumber: string; cnt: bigint }>>`
        SELECT "accessionNumber", COUNT(*) as cnt
        FROM "book_items"
        GROUP BY "accessionNumber"
        HAVING COUNT(*) > 1
      `,
      prisma.$queryRaw<Array<{ epc: string; cnt: bigint }>>`
        SELECT "epc", COUNT(*) as cnt
        FROM "rfid_tags"
        GROUP BY "epc"
        HAVING COUNT(*) > 1
      `,
      prisma.fine.count({
        where: { balance: { lt: 0 } },
      }),
    ]);
    const integrityQueryMs = Date.now() - start;

    expect(dupAccessions.length).toBe(0);
    expect(dupEpcs.length).toBe(0);
    expect(negativeFines).toBe(0);
    expect(integrityQueryMs).toBeLessThan(5000);
  });
});
