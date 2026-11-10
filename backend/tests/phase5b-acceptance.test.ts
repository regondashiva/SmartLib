import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { appendSip2Checksum } from '../src/modules/adapters/adapters.service.js';

describe('Phase 5B — Final AISYS Acceptance Verification Suite (Sections 2–7)', () => {
  let adminToken = '';
  let librarianToken = '';
  let operatorToken = '';
  let adminUserId = '';
  let testMemberId = '';
  let testMemberCard = '';
  let testBookId = '';
  let itemVerifiedId = '';
  let itemVerifiedAcc = '';
  let itemVerifiedEpc = '';
  let itemMisplacedId = '';
  let itemMisplacedAcc = '';
  let itemMisplacedEpc = '';
  let itemMissingId = '';
  let itemMissingAcc = '';
  let itemMissingEpc = '';
  let itemRefOnlyId = '';
  let itemRefOnlyAcc = '';

  const uniqueSuffix = Date.now().toString().slice(-6);
  const shelfTarget = `STACK-5B-${uniqueSuffix}-A`;
  const shelfOther = `STACK-5B-${uniqueSuffix}-B`;

  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'System Administrator', isSystemRole: true },
    });
    const libRole = await prisma.role.upsert({
      where: { name: 'LIBRARIAN' },
      update: {},
      create: { name: 'LIBRARIAN', description: 'Librarian', isSystemRole: true },
    });
    const opRole = await prisma.role.upsert({
      where: { name: 'RFID_OPERATOR' },
      update: {},
      create: { name: 'RFID_OPERATOR', description: 'RFID Operator', isSystemRole: true },
    });

    const adminUser = await prisma.user.upsert({
      where: { email: 'admin.phase5b@smartlib.local' },
      update: { roleId: adminRole.id, status: 'ACTIVE' },
      create: {
        email: 'admin.phase5b@smartlib.local',
        passwordHash: 'hashed_pw',
        firstName: 'Phase5B',
        lastName: 'Admin',
        roleId: adminRole.id,
        status: 'ACTIVE',
      },
    });
    adminUserId = adminUser.id;

    const libUser = await prisma.user.upsert({
      where: { email: 'librarian.phase5b@smartlib.local' },
      update: { roleId: libRole.id, status: 'ACTIVE' },
      create: {
        email: 'librarian.phase5b@smartlib.local',
        passwordHash: 'hashed_pw',
        firstName: 'Phase5B',
        lastName: 'Librarian',
        roleId: libRole.id,
        status: 'ACTIVE',
      },
    });

    const opUser = await prisma.user.upsert({
      where: { email: 'operator.phase5b@smartlib.local' },
      update: { roleId: opRole.id, status: 'ACTIVE' },
      create: {
        email: 'operator.phase5b@smartlib.local',
        passwordHash: 'hashed_pw',
        firstName: 'Phase5B',
        lastName: 'Operator',
        roleId: opRole.id,
        status: 'ACTIVE',
      },
    });

    adminToken = generateAccessToken({
      userId: adminUser.id,
      email: adminUser.email,
      role: 'ADMIN',
    });
    librarianToken = generateAccessToken({
      userId: libUser.id,
      email: libUser.email,
      role: 'LIBRARIAN',
    });
    operatorToken = generateAccessToken({
      userId: opUser.id,
      email: opUser.email,
      role: 'RFID_OPERATOR',
    });

    // Ensure RFID devices exist
    await prisma.rFIDDevice.upsert({
      where: { deviceCode: 'GATE-5B-01' },
      update: { status: 'ONLINE' },
      create: {
        deviceCode: 'GATE-5B-01',
        name: 'Phase 5B Dual-Pedestal Gate',
        deviceType: 'SECURITY_GATE',
        location: 'Main Exit Lobby',
        status: 'ONLINE',
      },
    });

    await prisma.rFIDDevice.upsert({
      where: { deviceCode: 'HANDHELD-5B-01' },
      update: { status: 'ONLINE' },
      create: {
        deviceCode: 'HANDHELD-5B-01',
        name: 'Phase 5B Handheld UHF Wand',
        deviceType: 'HANDHELD_READER',
        location: 'Stacks Floor 1',
        status: 'ONLINE',
      },
    });

    // Create synthetic test member
    testMemberCard = `MEM-5B-${uniqueSuffix}`;
    const member = await prisma.member.create({
      data: {
        cardNumber: testMemberCard,
        smartCardUid: `UID-5B-${uniqueSuffix}`,
        firstName: 'Siddharth',
        lastName: 'Verma',
        email: `siddharth.${uniqueSuffix}@smartlib.local`,
        phoneNumber: '+919876543210',
        memberType: 'FACULTY',
        department: 'Computer Engineering',
        status: 'ACTIVE',
        maxBorrowLimit: 6,
        expiryDate: new Date(Date.now() + 365 * 86400000),
      },
    });
    testMemberId = member.id;

    // Create synthetic test book and copies for RFID inventory, gate, and NCIP/SIP2 tests
    const book = await prisma.book.create({
      data: {
        title: `Phase 5B Verification Monograph ${uniqueSuffix}`,
        isbn13: `9788199${uniqueSuffix}`,
        callNumber: `005.13 P5B-${uniqueSuffix}`,
        language: 'English',
        publicationYear: 2026,
      },
    });
    testBookId = book.id;

    itemVerifiedAcc = `ACC-5B-V-${uniqueSuffix}`;
    itemVerifiedEpc = `3034257BF45B010000${uniqueSuffix}`;
    const tagV = await prisma.rFIDTag.create({
      data: { epc: itemVerifiedEpc, easArmed: true, status: 'ACTIVE', encodedAt: new Date() },
    });
    const copyV = await prisma.bookItem.create({
      data: {
        bookId: testBookId,
        accessionNumber: itemVerifiedAcc,
        barcode: `BC-${itemVerifiedAcc}`,
        rfidTagId: tagV.id,
        shelfLocation: shelfTarget,
        status: 'AVAILABLE',
      },
    });
    itemVerifiedId = copyV.id;

    itemMisplacedAcc = `ACC-5B-M-${uniqueSuffix}`;
    itemMisplacedEpc = `3034257BF45B020000${uniqueSuffix}`;
    const tagM = await prisma.rFIDTag.create({
      data: { epc: itemMisplacedEpc, easArmed: true, status: 'ACTIVE', encodedAt: new Date() },
    });
    const copyM = await prisma.bookItem.create({
      data: {
        bookId: testBookId,
        accessionNumber: itemMisplacedAcc,
        barcode: `BC-${itemMisplacedAcc}`,
        rfidTagId: tagM.id,
        shelfLocation: shelfOther,
        status: 'AVAILABLE',
      },
    });
    itemMisplacedId = copyM.id;

    itemMissingAcc = `ACC-5B-X-${uniqueSuffix}`;
    itemMissingEpc = `3034257BF45B030000${uniqueSuffix}`;
    const tagX = await prisma.rFIDTag.create({
      data: { epc: itemMissingEpc, easArmed: true, status: 'ACTIVE', encodedAt: new Date() },
    });
    const copyX = await prisma.bookItem.create({
      data: {
        bookId: testBookId,
        accessionNumber: itemMissingAcc,
        barcode: `BC-${itemMissingAcc}`,
        rfidTagId: tagX.id,
        shelfLocation: shelfTarget,
        status: 'AVAILABLE',
      },
    });
    itemMissingId = copyX.id;

    itemRefOnlyAcc = `ACC-5B-REF-${uniqueSuffix}`;
    const copyRef = await prisma.bookItem.create({
      data: {
        bookId: testBookId,
        accessionNumber: itemRefOnlyAcc,
        barcode: `BC-${itemRefOnlyAcc}`,
        shelfLocation: shelfTarget,
        status: 'REFERENCE_ONLY',
        isReferenceOnly: true,
      },
    });
    itemRefOnlyId = copyRef.id;
  }, 60000);

  it('1. [Section 2] Verifies RFID handheld inventory (bulk reads, duplicate EPC filtering, missing/misplaced, accession recording, visible/audible confirmation) & security gate (unauthorized item, offline bit read, alarm, entry/exit footfall)', async () => {
    const uncatalogedEpc = `3034257BF499990000${uniqueSuffix}`;

    // 1.1 Handheld bulk sweep with duplicate EPCs
    const invRes = await request(app)
      .post('/api/v1/rfid/inventory-sessions')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        targetLocation: shelfTarget,
        deviceCode: 'HANDHELD-5B-01',
        scannedEpcs: [
          itemVerifiedEpc,
          itemVerifiedEpc, // Duplicate EPC read #1
          itemMisplacedEpc,
          itemMisplacedEpc, // Duplicate EPC read #2
          uncatalogedEpc,
        ],
      });

    expect(invRes.status).toBe(201);
    expect(invRes.body.data.summary).toMatchObject({
      rawScanCount: 5,
      uniqueScannedCount: 3,
      duplicateScanCount: 2,
      totalVerified: 1,
      totalMisplaced: 1,
      totalMissing: 2, // itemMissing + itemRefOnly on shelfTarget
      totalUncataloged: 1,
    });

    // Verify visible & audible handheld confirmation
    expect(invRes.body.data.handheldConfirmation.visibleIndicator).toBe('AMBER_LED_BLINK');
    expect(invRes.body.data.handheldConfirmation.audibleAlert).toBe('DOUBLE_BEEP_800HZ_ATTENTION');

    const verifiedScan = invRes.body.data.scans.find(
      (s: { scannedEpc: string }) => s.scannedEpc === itemVerifiedEpc
    );
    expect(verifiedScan.accessionNumber).toBe(itemVerifiedAcc);
    expect(verifiedScan.handheldFeedback.visibleIndicator).toBe('GREEN_LED_FLASH');
    expect(verifiedScan.handheldFeedback.audibleAlert).toBe('SINGLE_BEEP_2KHZ');

    // 1.2 Security Gate Unauthorized Item Transit (Armed EAS bit, Offline Security Bit Read, Alarm + CCTV Attachment)
    const gateAlarmRes = await request(app)
      .post('/api/v1/rfid/gate-events')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        deviceCode: 'GATE-5B-01',
        tagEpc: itemVerifiedEpc,
        direction: 'EXIT',
        footfallCount: 12,
        offlineBuffered: true,
      });

    expect(gateAlarmRes.status).toBe(201);
    expect(gateAlarmRes.body.data.alarmTriggered).toBe(true);
    expect(gateAlarmRes.body.data.easArmed).toBe(true);
    expect(gateAlarmRes.body.data.unauthorizedItemDetected).toBe(true);
    expect(gateAlarmRes.body.data.offlineSecurityBitRead).toBe(true);
    expect(gateAlarmRes.body.data.accessionNumber).toBe(itemVerifiedAcc);
    expect(gateAlarmRes.body.data.direction).toBe('EXIT');
    expect(gateAlarmRes.body.data.cctvImageAttachment.mimeType).toBe('image/svg+xml');
    expect(gateAlarmRes.body.data.cctvImageAttachment.dataUri).toContain(
      'data:image/svg+xml;base64,'
    );

    const gateEventId = gateAlarmRes.body.data.id;

    // 1.3 Retrieve CCTV Snapshot directly for the Gate Event
    const cctvRes = await request(app)
      .get(`/api/v1/rfid/gate-events/${gateEventId}/cctv-snapshot`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(cctvRes.status).toBe(200);
    expect(cctvRes.body.data.accessionNumber).toBe(itemVerifiedAcc);
    expect(cctvRes.body.data.cctvImageAttachment.svgMarkup).toContain(itemVerifiedAcc);

    // 1.4 Record Entry & Exit Footfall Events and verify summary
    const entryRes = await request(app)
      .post('/api/v1/rfid/footfall')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ deviceCode: 'GATE-5B-01', direction: 'ENTRY', count: 3 });
    expect(entryRes.status).toBe(201);
    expect(entryRes.body.data.direction).toBe('ENTRY');

    const footfallSum = await request(app)
      .get('/api/v1/rfid/footfall')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(footfallSum.status).toBe(200);
    expect(footfallSum.body.data.totalEntries).toBeGreaterThanOrEqual(3);
    expect(footfallSum.body.data.totalExits).toBeGreaterThanOrEqual(1);
  }, 45000);

  it('2. [Section 3] Verifies Camera synthetic image adapter, Email/SMS/Print notification adapters, queue state machine (PENDING -> SENT / FAILED -> RETRY -> SENT), per-user preferences, and audit logs', async () => {
    // 2.1 Camera Adapter Command returning synthetic SVG image
    const camRes = await request(app)
      .post('/api/v1/adapters/devices/CAMERA/command')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        command: 'CAPTURE_SNAPSHOT',
        payload: {
          deviceCode: 'GATE-5B-01',
          tagEpc: itemVerifiedEpc,
          accessionNumber: itemVerifiedAcc,
          alarmTriggered: true,
        },
      });
    expect(camRes.status).toBe(200);
    expect(camRes.body.data.syntheticImage.mimeType).toBe('image/svg+xml');
    expect(camRes.body.data.syntheticImage.svgMarkup).toContain(itemVerifiedAcc);

    // 2.2 Enqueue & Dispatch EMAIL Notification (PENDING -> SENT)
    const emailEnq = await request(app)
      .post('/api/v1/notifications/enqueue')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        memberId: testMemberId,
        channel: 'EMAIL',
        type: 'DUE_REMINDER',
        subject: 'Upcoming Due Date Reminder',
        message: 'Your borrowed monograph is due in 2 days.',
      });
    expect(emailEnq.status).toBe(201);
    expect(emailEnq.body.data.status).toBe('PENDING');

    const emailDisp = await request(app)
      .post(`/api/v1/notifications/${emailEnq.body.data.id}/dispatch`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({});
    expect(emailDisp.status).toBe(200);
    expect(emailDisp.body.data.status).toBe('SENT');
    expect(emailDisp.body.data.dispatchResult.providerName).toContain('MockSmtpEmailAdapter');

    // 2.3 Enqueue & Dispatch PRINT Slip Notification (PENDING -> SENT)
    const printEnq = await request(app)
      .post('/api/v1/notifications/enqueue')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        memberId: testMemberId,
        channel: 'PRINT',
        type: 'FINE_NOTICE',
        subject: 'Circulation Slip & Fine Notice',
        message: 'Please retain this slip for your records.',
      });
    expect(printEnq.status).toBe(201);

    const printDisp = await request(app)
      .post(`/api/v1/notifications/${printEnq.body.data.id}/dispatch`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({});
    expect(printDisp.status).toBe(200);
    expect(printDisp.body.data.status).toBe('SENT');
    expect(printDisp.body.data.queueMeta.renderedSlipOrPayload).toContain(
      'SMARTLIB INSTITUTIONAL SLIP'
    );

    // 2.4 Enqueue SMS Notification, simulate failure (PENDING -> FAILED), then RETRY -> SENT
    const smsEnq = await request(app)
      .post('/api/v1/notifications/enqueue')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        memberId: testMemberId,
        channel: 'SMS',
        type: 'OVERDUE_ALERT',
        recipient: '+910000000000', // Triggers simulated gateway failure
        subject: 'Overdue Alert',
        message: 'Book ACC-5B is overdue.',
      });
    expect(smsEnq.status).toBe(201);

    const smsFail = await request(app)
      .post(`/api/v1/notifications/${smsEnq.body.data.id}/dispatch`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ simulateFailure: true });
    expect(smsFail.status).toBe(200);
    expect(smsFail.body.data.status).toBe('FAILED');
    expect(smsFail.body.data.queueMeta.retryCount).toBe(1);

    // Retry failed SMS with valid number -> SENT
    const smsRetry = await request(app)
      .post(`/api/v1/notifications/${smsEnq.body.data.id}/retry`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ overrideRecipient: '+919876543210', simulateFailure: false });
    expect(smsRetry.status).toBe(200);
    expect(smsRetry.body.data.status).toBe('SENT');

    // 2.5 Per-User Notification Preferences enforcement
    const prefUpdate = await request(app)
      .put(`/api/v1/notifications/preferences/${testMemberId}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ smsEnabled: false });
    expect(prefUpdate.status).toBe(200);
    expect(prefUpdate.body.data.smsEnabled).toBe(false);

    const blockedSms = await request(app)
      .post('/api/v1/notifications/enqueue')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        memberId: testMemberId,
        channel: 'SMS',
        type: 'OVERDUE_ALERT',
        subject: 'Blocked SMS',
        message: 'Should be blocked by user preference',
      });
    expect(blockedSms.status).toBe(400);
  }, 45000);

  it('3. [Section 4] Verifies NCIP 2.0 & 3M SIP2 end-to-end circulation (lookup, checkout, duplicate checkout rejection, reference-only policy rejection, renewal, check-in, and AuditLog verification)', async () => {
    // 3.1 NCIP 2.0 LookupUser & LookupItem
    const ncipUser = await request(app)
      .post('/api/v1/adapters/ncip')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ service: 'LookupUser', cardNumber: testMemberCard });
    expect(ncipUser.status).toBe(200);
    expect(ncipUser.body.data.userId).toBe(testMemberId);

    // 3.2 NCIP 2.0 Invalid Request: Attempt to check out a REFERENCE_ONLY book (must enforce same policy as staff UI)
    const ncipRefBlock = await request(app)
      .post('/api/v1/adapters/ncip')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        service: 'CheckOutItem',
        cardNumber: testMemberCard,
        accessionNumber: itemRefOnlyAcc,
      });
    expect(ncipRefBlock.status).toBe(200);
    expect(ncipRefBlock.body.data.problem).toBeDefined();
    expect(ncipRefBlock.body.data.problem.problemDetail).toMatch(/reference/i);

    // 3.3 NCIP 2.0 Valid CheckOutItem -> Disarms EAS bit
    const ncipOut = await request(app)
      .post('/api/v1/adapters/ncip')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        service: 'CheckOutItem',
        cardNumber: testMemberCard,
        accessionNumber: itemVerifiedAcc,
      });
    expect(ncipOut.status).toBe(200);
    expect(ncipOut.body.data.easArmed).toBe(false);

    // 3.4 NCIP 2.0 Duplicate Checkout Request -> Rejected because item is already ISSUED
    const ncipDupOut = await request(app)
      .post('/api/v1/adapters/ncip')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        service: 'CheckOutItem',
        cardNumber: testMemberCard,
        accessionNumber: itemVerifiedAcc,
      });
    expect(ncipDupOut.status).toBe(200);
    expect(ncipDupOut.body.data.problem).toBeDefined();

    // 3.5 SIP2 29/30 Renew Item & 09/10 Checkin Item
    const sipRenewMsg = appendSip2Checksum(
      `29YN20261109    090000|AOSMARTLIB|AA${testMemberCard}|AB${itemVerifiedAcc}`,
      '2'
    );
    const sipRenewRes = await request(app)
      .post('/api/v1/adapters/sip2')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ message: sipRenewMsg });
    expect(sipRenewRes.status).toBe(200);
    expect(sipRenewRes.body.data.renewSucceeded).toBe(true);

    const sipCheckinMsg = appendSip2Checksum(
      `09N20261109    09000020261109    090000|AOSMARTLIB|AB${itemVerifiedAcc}`,
      '3'
    );
    const sipCheckinRes = await request(app)
      .post('/api/v1/adapters/sip2')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ message: sipCheckinMsg });
    expect(sipCheckinRes.status).toBe(200);
    expect(sipCheckinRes.body.data.checkinSucceeded).toBe(true);

    // 3.6 SIP2 Duplicate Checkin Request -> Rejected because item is already AVAILABLE
    const sipDupCheckin = await request(app)
      .post('/api/v1/adapters/sip2')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ message: sipCheckinMsg });
    expect(sipDupCheckin.status).toBe(200);
    expect(sipDupCheckin.body.data.checkinSucceeded).toBe(false);

    // 3.7 Verify AuditLog recorded NCIPAdapter & SIP2Adapter entries
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityName: { in: ['NCIPAdapter', 'SIP2Adapter'] } },
      take: 5,
    });
    expect(auditLogs.length).toBeGreaterThanOrEqual(2);
  }, 45000);

  it('4. [Section 5] Executes real non-dry-run offline package installation into an isolated directory and verifies SHA-256 receipts', async () => {
    const cwd = process.cwd();
    const projectRoot = fs.existsSync(path.join(cwd, 'backend', 'package.json'))
      ? cwd
      : path.resolve(cwd, '..');
    const scriptPath = path.join(
      projectRoot,
      'deploy',
      'offline-package',
      'scripts',
      'install-offline.ps1'
    );
    const targetInstallDir = path.join(projectRoot, 'data', 'isolated-offline-install-5b');

    const output = execSync(
      `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -TargetDir "${targetInstallDir}"`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('real offline installation completed');
    const receiptPath = path.join(targetInstallDir, 'installation-receipt.json');
    expect(fs.existsSync(receiptPath)).toBe(true);

    const receipt = JSON.parse(
      fs.readFileSync(receiptPath, 'utf-8').replace(/^\uFEFF/, '')
    );
    expect(receipt.dryRun).toBe(false);
    expect(receipt.installationMode).toBe('REAL_OFFLINE_ISOLATED_INSTALL');
    expect(fs.existsSync(path.join(targetInstallDir, 'frontend', 'dist', 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(targetInstallDir, 'backend', 'dist', 'app.js'))).toBe(true);
    expect(fs.existsSync(path.join(targetInstallDir, 'rfid-service', 'main.py'))).toBe(true);
  }, 45000);

  it('5. [Section 6 & 7] Performs a real PostgreSQL SQL backup, simulates a destructive migration failure, restores into a separate isolated PostgreSQL schema, and generates CycloneDX 1.5 SBOM', async () => {
    // 5.1 Real PostgreSQL SQL Backup + Simulated Failure + Isolated Restore
    const restoreRes = await request(app)
      .post('/api/v1/system/postgresql-restore-test')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(restoreRes.status).toBe(201);
    const report = restoreRes.body.data;
    expect(report.backupFile.fileName).toMatch(/\.sql$/);
    expect(report.backupFile.sha256Checksum).toHaveLength(64);
    expect(report.simulatedFailure.executed).toBe(true);
    expect(report.simulatedFailure.sourceCorruptedState.circulationsTableDropped).toBe(true);
    expect(report.simulatedFailure.sourceCorruptedState.bookItemsRemainingInCorruptedSource).toBe(0);

    expect(report.restorationResult.executedIntoSeparateIsolatedTarget).toBe(true);
    expect(report.restorationResult.foreignKeyRelationshipsVerified).toBe(true);
    expect(report.restorationResult.applicationQueryAccessVerified).toBe(true);
    expect(report.restorationResult.restoredRowCounts).toMatchObject({
      publishers: 2,
      categories: 2,
      books: 2,
      rfid_tags: 2,
      book_items: 2,
      members: 2,
      circulations: 1,
      fines: 1,
    });
    expect(report.primaryPublicSchemaPreserved.verified).toBe(true);

    // 5.2 CycloneDX 1.5 SBOM & License Inventory
    const sbomRes = await request(app)
      .get('/api/v1/system/sbom')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sbomRes.status).toBe(200);
    expect(sbomRes.body.data.bomFormat).toBe('CycloneDX');
    expect(sbomRes.body.data.specVersion).toBe('1.5');
    expect(sbomRes.body.data.totalComponents).toBeGreaterThan(20);
  }, 60000);
});
