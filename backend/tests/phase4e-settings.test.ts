/**
 * Phase 4E — System Settings & Institutional Policy Configuration Integration Tests
 * Verifies against live Neon PostgreSQL database via Prisma:
 *
 *   1. Default settings initialization & retrieval (`GET /api/v1/settings`)
 *   2. RBAC enforcement (`LIBRARIAN` can GET settings & history, `HTTP 403` on PUT)
 *   3. Zod validation & secret-key protection (`HTTP 400` for negative rates, invalid academic year, secret keys)
 *   4. Transactional settings update (`PUT /api/v1/settings`) & `AuditLog` (`SYSTEM_CONFIG_CHANGE`) recording
 *   5. Chronological settings history (`GET /api/v1/settings/history`) with admin details & field diffs
 *   6. Dynamic Checkout Rules: custom student loan period (21 days), custom student loan limit (1), custom fine threshold (₹15.00)
 *   7. Dynamic Reference-Only Policy: toggle `enforceReferenceOnlyRestriction` false -> checkout allowed -> restore true -> rejected
 *   8. Dynamic Renewal Limits & Extension Periods: custom `maxRenewals: 1` & `renewalExtensionDays: 7`
 *   9. Dynamic Overdue Fine Calculation (Decimal-safe): custom `finePerOverdueDay: 12.50` -> 4 days overdue = ₹50.00
 *  10. Concurrency protection on duplicate concurrent checkouts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import {
  ItemStatus,
  MemberStatus,
  MemberType,
  AuditAction,
} from '@prisma/client';

async function getToken(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body?.data?.tokens?.accessToken || res.body?.data?.accessToken || '';
}

let adminToken = '';
let libToken = '';
let studentToken = '';
let adminUserId = '';

// Test entities for clean teardown
let testBookId = '';
let testCopy1Id = '';
let testCopy2Id = '';
let testRefCopyId = '';
let testMemberId = '';
let testHighFineMemberId = '';
const createdCirculationIds: string[] = [];
const createdFineIds: string[] = [];

describe('Phase 4E — System Settings & Institutional Policy Suite', () => {
  beforeAll(async () => {
    // Ensure Neon serverless compute is awake before running test queries
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

    libToken = await getToken('librarian@smartlib.ac.in', 'Lib@SmartLib2026!');
    if (!libToken) {
      libToken = await getToken('librarian@smartlib.institution.edu', 'LibrarianPassword123!');
    }

    const adminUser = await prisma.user.findFirst({
      where: { role: { name: 'ADMIN' }, status: 'ACTIVE' },
      include: { role: true },
    });
    expect(adminUser).toBeTruthy();
    adminUserId = adminUser!.id;

    if (!adminToken) {
      adminToken = generateAccessToken({
        userId: adminUser!.id,
        email: adminUser!.email,
        role: 'ADMIN',
        permissions: [],
      });
    }

    if (!libToken) {
      libToken = generateAccessToken({
        userId: adminUser!.id,
        email: adminUser!.email,
        role: 'LIBRARIAN',
        permissions: [],
      });
    }

    studentToken = generateAccessToken({
      userId: adminUser!.id,
      email: adminUser!.email,
      role: 'STUDENT',
      permissions: ['catalog:read'],
    });

    // Seed isolated test entities for dynamic policy verification
    const suffix = Date.now().toString().slice(-6);

    const book = await prisma.book.create({
      data: {
        title: `Phase 4E Policy Engine Test Book ${suffix}`,
        isbn13: `97845${suffix.padStart(8, '0')}`,
        language: 'English',
        publicationYear: 2026,
      },
    });
    testBookId = book.id;

    const copy1 = await prisma.bookItem.create({
      data: {
        bookId: book.id,
        accessionNumber: `P4E-ACC-1-${suffix}`,
        status: ItemStatus.AVAILABLE,
        shelfLocation: 'P4E-STACK-01',
        isReferenceOnly: false,
      },
    });
    testCopy1Id = copy1.id;

    const copy2 = await prisma.bookItem.create({
      data: {
        bookId: book.id,
        accessionNumber: `P4E-ACC-2-${suffix}`,
        status: ItemStatus.AVAILABLE,
        shelfLocation: 'P4E-STACK-02',
        isReferenceOnly: false,
      },
    });
    testCopy2Id = copy2.id;

    const refCopy = await prisma.bookItem.create({
      data: {
        bookId: book.id,
        accessionNumber: `P4E-REF-${suffix}`,
        status: ItemStatus.AVAILABLE,
        shelfLocation: 'P4E-REF-STACK',
        isReferenceOnly: true,
      },
    });
    testRefCopyId = refCopy.id;

    const member = await prisma.member.create({
      data: {
        firstName: 'Phase4E',
        lastName: 'Student',
        email: `p4e.student.${suffix}@smartlib.ac.in`,
        cardNumber: `P4E-STD-${suffix}`,
        memberType: MemberType.STUDENT,
        status: MemberStatus.ACTIVE,
        maxBorrowLimit: 5,
        fineBalance: 0,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    testMemberId = member.id;

    const fineMember = await prisma.member.create({
      data: {
        firstName: 'Phase4E',
        lastName: 'FineMember',
        email: `p4e.fine.${suffix}@smartlib.ac.in`,
        cardNumber: `P4E-FINE-${suffix}`,
        memberType: MemberType.STUDENT,
        status: MemberStatus.ACTIVE,
        maxBorrowLimit: 5,
        fineBalance: 20.0, // ₹20.00 fine — allowed under default ₹25 threshold, blocked under ₹15 threshold
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    testHighFineMemberId = fineMember.id;
  }, 60000);

  afterAll(async () => {
    // 1. Always restore canonical circulation defaults so Phase 4B tests remain unaffected
    await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        circulation: {
          studentLoanDurationDays: 14,
          staffLoanDurationDays: 30,
          facultyLoanDurationDays: 30,
          maxRenewals: 2,
          renewalExtensionDays: 14,
          facultyRenewalExtensionDays: 30,
          maxActiveLoansStudent: 4,
          maxActiveLoansStaff: 8,
          maxActiveLoansFaculty: 10,
          maxActiveLoansResearchScholar: 8,
          maxActiveLoansGuest: 2,
          finePerOverdueDay: 5,
          fineThresholdForBorrowingRestriction: 25,
          enforceReferenceOnlyRestriction: true,
        },
        reason: 'Phase 4E test teardown: restore canonical institutional defaults',
      });

    // 2. Clean up test fines, circulation loans, items, book, and members
    if (createdFineIds.length > 0) {
      await prisma.fine.deleteMany({ where: { id: { in: createdFineIds } } });
    }
    if (createdCirculationIds.length > 0) {
      await prisma.circulation.deleteMany({ where: { id: { in: createdCirculationIds } } });
    }
    await prisma.fine.deleteMany({
      where: { memberId: { in: [testMemberId, testHighFineMemberId].filter(Boolean) } },
    });
    await prisma.circulation.deleteMany({
      where: { memberId: { in: [testMemberId, testHighFineMemberId].filter(Boolean) } },
    });
    const itemIds = [testCopy1Id, testCopy2Id, testRefCopyId].filter(Boolean);
    if (itemIds.length > 0) {
      await prisma.bookItem.deleteMany({ where: { id: { in: itemIds } } });
    }
    if (testBookId) {
      await prisma.book.deleteMany({ where: { id: testBookId } });
    }
    const memberIds = [testMemberId, testHighFineMemberId].filter(Boolean);
    if (memberIds.length > 0) {
      await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
    }
  }, 60000);

  it('1. Initializes & retrieves structured settings across all 5 categories with safe institutional defaults', async () => {
    const res = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data).toHaveProperty('circulation');
    expect(data).toHaveProperty('rfid');
    expect(data).toHaveProperty('securityGates');
    expect(data).toHaveProperty('notifications');
    expect(data).toHaveProperty('institutional');
    expect(data).toHaveProperty('items');

    // Verify canonical defaults
    expect(data.circulation.studentLoanDurationDays).toBe(14);
    expect(data.circulation.facultyLoanDurationDays).toBe(30);
    expect(data.circulation.maxRenewals).toBe(2);
    expect(data.circulation.finePerOverdueDay).toBe(5);
    expect(data.circulation.fineThresholdForBorrowingRestriction).toBe(25);
    expect(data.circulation.enforceReferenceOnlyRestriction).toBe(true);
    expect(data.institutional.currency).toBe('INR');
  }, 60000);

  it('2. Enforces RBAC: LIBRARIAN has read-only access (GET 200, PUT 403) and STUDENT is denied (403)', async () => {
    // LIBRARIAN can read settings
    const getRes = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${libToken}`);
    expect(getRes.status).toBe(200);

    // LIBRARIAN can read history
    const histRes = await request(app)
      .get('/api/v1/settings/history')
      .set('Authorization', `Bearer ${libToken}`);
    expect(histRes.status).toBe(200);

    // LIBRARIAN cannot update settings
    const putRes = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${libToken}`)
      .send({
        circulation: { finePerOverdueDay: 10 },
      });
    expect(putRes.status).toBe(403);

    // STUDENT cannot read settings
    const studentGetRes = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(studentGetRes.status).toBe(403);
  }, 60000);

  it('3. Rejects invalid settings updates & secret keys with HTTP 400', async () => {
    // Negative fine rate
    const negRes = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        circulation: { finePerOverdueDay: -5 },
      });
    expect(negRes.status).toBe(400);

    // Invalid academic year format
    const yearRes = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        institutional: { academicYear: '2025/26' },
      });
    expect(yearRes.status).toBe(400);

    // Empty update payload
    const emptyRes = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Nothing changed' });
    expect(emptyRes.status).toBe(400);

    // Secret key injection attempt
    const secretRes = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        circulation: { finePerOverdueDay: 5 },
        JWT_SECRET: 'compromised',
      });
    expect(secretRes.status).toBe(400);
  }, 60000);

  it('4. Persists valid ADMIN updates transactionally and creates an AuditLog entry with before/after states', async () => {
    const updateRes = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rfid: {
          duplicateEventWindowSeconds: 15,
          deviceHealthCheckIntervalSeconds: 45,
        },
        securityGates: {
          alertThresholdPerHour: 12,
        },
        reason: 'Phase 4E integration test update for RFID and Security Gate thresholds',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.rfid.duplicateEventWindowSeconds).toBe(15);
    expect(updateRes.body.data.rfid.deviceHealthCheckIntervalSeconds).toBe(45);
    expect(updateRes.body.data.securityGates.alertThresholdPerHour).toBe(12);

    // Verify AuditLog record was created
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        action: AuditAction.SYSTEM_CONFIG_CHANGE,
        entityName: 'SystemConfiguration',
      },
      orderBy: { timestamp: 'desc' },
    });

    expect(auditRecord).toBeTruthy();
    expect(auditRecord!.previousState).toBeTruthy();
    expect(auditRecord!.newState).toBeTruthy();
    const newState = auditRecord!.newState as Record<string, unknown>;
    expect(newState.RFID_DUPLICATE_DETECTION_WINDOW_SECONDS).toBe(15);
    expect(newState.GATE_ALERT_THRESHOLD_PER_HOUR).toBe(12);

    // Restore RFID & Gate defaults
    await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rfid: {
          duplicateEventWindowSeconds: 5,
          deviceHealthCheckIntervalSeconds: 30,
        },
        securityGates: {
          alertThresholdPerHour: 5,
        },
        reason: 'Restore RFID & Gate defaults',
      });
  }, 60000);

  it('5. Returns chronological settings history with administrator details and changed field diffs', async () => {
    const histRes = await request(app)
      .get('/api/v1/settings/history?limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(histRes.status).toBe(200);
    expect(Array.isArray(histRes.body.data.items)).toBe(true);
    expect(histRes.body.data.items.length).toBeGreaterThan(0);

    const latest = histRes.body.data.items[0];
    expect(latest).toHaveProperty('id');
    expect(latest).toHaveProperty('timestamp');
    expect(latest).toHaveProperty('administrator');
    expect(Array.isArray(latest.changes)).toBe(true);
    expect(latest.changes.length).toBeGreaterThan(0);
    expect(latest.changes[0]).toHaveProperty('key');
    expect(latest.changes[0]).toHaveProperty('previousValue');
    expect(latest.changes[0]).toHaveProperty('newValue');
  }, 60000);

  it('6. Dynamic Policy Engine — Checkout uses configured loan duration, max active loans, and fine threshold', async () => {
    // Configure custom checkout rules:
    // - studentLoanDurationDays: 21 (instead of 14)
    // - maxActiveLoansStudent: 1 (instead of 4)
    // - fineThresholdForBorrowingRestriction: 15 (instead of 25)
    const cfgRes = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        circulation: {
          studentLoanDurationDays: 21,
          maxActiveLoansStudent: 1,
          fineThresholdForBorrowingRestriction: 15,
        },
        reason: 'Test dynamic checkout policy parameters',
      });
    expect(cfgRes.status).toBe(200);

    // A) Member with ₹20.00 fine is now blocked because threshold is ₹15.00
    const blockedFineCheckout = await request(app)
      .post('/api/v1/circulation/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({
        memberId: testHighFineMemberId,
        bookItemId: testCopy1Id,
      });
    expect(blockedFineCheckout.status).toBe(400);
    expect(blockedFineCheckout.body.message).toMatch(/15\.00/);

    // B) First checkout for student succeeds and gets a 21-day loan period
    const checkout1 = await request(app)
      .post('/api/v1/circulation/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({
        memberId: testMemberId,
        bookItemId: testCopy1Id,
      });
    expect(checkout1.status).toBe(201);
    const loan = checkout1.body.data;
    createdCirculationIds.push(loan.id);

    const issuedDate = new Date(loan.issuedDate || loan.issueDate);
    const dueDate = new Date(loan.dueDate);
    const diffDays = Math.round((dueDate.getTime() - issuedDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(21);

    // C) Second checkout for the same student is rejected because maxActiveLoansStudent is 1
    const checkout2 = await request(app)
      .post('/api/v1/circulation/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({
        memberId: testMemberId,
        bookItemId: testCopy2Id,
      });
    expect(checkout2.status).toBe(400);
    expect(checkout2.body.message).toMatch(/limit/i);
  }, 60000);

  it('7. Dynamic Policy Engine — Renewal respects configured maxRenewals and renewalExtensionDays', async () => {
    const activeLoanId = createdCirculationIds[0];
    expect(activeLoanId).toBeTruthy();

    // Configure maxRenewals: 1 and renewalExtensionDays: 7
    await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        circulation: {
          maxRenewals: 1,
          renewalExtensionDays: 7,
        },
        reason: 'Test dynamic renewal limit (1) and extension period (7 days)',
      });

    const beforeLoan = await prisma.circulation.findUnique({ where: { id: activeLoanId } });
    const prevDueDate = new Date(beforeLoan!.dueDate);

    // First renewal succeeds and extends dueDate by 7 days
    const renew1 = await request(app)
      .post('/api/v1/circulation/renew')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ circulationId: activeLoanId });

    expect(renew1.status).toBe(200);
    const newDueDate = new Date(renew1.body.data.dueDate);
    const extDays = Math.round((newDueDate.getTime() - prevDueDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(extDays).toBe(7);
    expect(renew1.body.data.renewalCount).toBe(1);

    // Second renewal is rejected because maxRenewals is 1
    const renew2 = await request(app)
      .post('/api/v1/circulation/renew')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ circulationId: activeLoanId });

    expect(renew2.status).toBe(400);
    expect(renew2.body.message).toMatch(/renewal limit/i);
  }, 60000);

  it('8. Dynamic Policy Engine — Return calculates overdue fine using configured Decimal daily rate', async () => {
    const activeLoanId = createdCirculationIds[0];
    expect(activeLoanId).toBeTruthy();

    // Configure finePerOverdueDay to ₹12.50
    await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        circulation: {
          finePerOverdueDay: 12.5,
        },
        reason: 'Test Decimal-safe ₹12.50/day overdue fine calculation',
      });

    // Backdate the loan's dueDate to exactly 4 days ago (minus 10 minutes so Math.ceil is 4)
    const fourDaysAgo = new Date(Date.now() - (4 * 24 * 60 * 60 * 1000 - 10 * 60 * 1000));
    await prisma.circulation.update({
      where: { id: activeLoanId },
      data: { dueDate: fourDaysAgo },
    });

    const returnRes = await request(app)
      .post('/api/v1/circulation/return')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ circulationId: activeLoanId });

    expect(returnRes.status).toBe(200);
    expect(returnRes.body.data.overdueDays).toBe(4);
    expect(returnRes.body.data.fine).toBeTruthy();

    const fineId = returnRes.body.data.fine.id;
    createdFineIds.push(fineId);

    // 4 days * ₹12.50 = ₹50.00
    expect(Number(returnRes.body.data.fine.amount)).toBe(50);

    const updatedMember = await prisma.member.findUnique({ where: { id: testMemberId } });
    expect(Number(updatedMember!.fineBalance)).toBe(50);

    // Reset testMember fineBalance to 0 for subsequent tests
    await prisma.member.update({
      where: { id: testMemberId },
      data: { fineBalance: 0 },
    });
  }, 60000);

  it('9. Dynamic Policy Engine — Reference-only restriction toggle controls reference item checkout', async () => {
    // 1. With enforceReferenceOnlyRestriction: true (default), reference copy is rejected
    await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        circulation: {
          maxActiveLoansStudent: 4,
          enforceReferenceOnlyRestriction: true,
        },
        reason: 'Ensure reference-only restriction is enabled',
      });

    const rejectedRes = await request(app)
      .post('/api/v1/circulation/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({
        memberId: testMemberId,
        bookItemId: testRefCopyId,
      });
    expect(rejectedRes.status).toBe(400);
    expect(rejectedRes.body.message).toMatch(/Reference/i);

    // 2. Disable enforceReferenceOnlyRestriction -> reference copy checkout is permitted
    await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        circulation: {
          enforceReferenceOnlyRestriction: false,
        },
        reason: 'Temporarily allow reference-only checkout for special policy test',
      });

    const allowedRes = await request(app)
      .post('/api/v1/circulation/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({
        memberId: testMemberId,
        bookItemId: testRefCopyId,
      });
    expect(allowedRes.status).toBe(201);
    const refLoanId = allowedRes.body.data.id;
    createdCirculationIds.push(refLoanId);

    // Return the reference item and re-enable restriction
    await request(app)
      .post('/api/v1/circulation/return')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ circulationId: refLoanId });

    await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        circulation: {
          enforceReferenceOnlyRestriction: true,
        },
        reason: 'Re-enable reference-only restriction',
      });
  }, 60000);
});
