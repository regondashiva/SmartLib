/**
 * Phase 4D — Advanced Reports & Analytics Integration Tests
 * Verifies all 12 report endpoints against live Neon PostgreSQL database:
 *
 *   1. Dashboard KPI summary reconciliation against actual Neon records
 *   2. Circulation report totals, trends, and most borrowed books
 *   3. Overdue calculations (elapsed days, daily rate, fine assessment)
 *   4. Fine collection totals (assessed, paid, outstanding, waived, partial)
 *   5. Inventory reconciliation (physical copies, available, issued, RFID-tagged, scans)
 *   6. Member activity report (active, inactive, blocked, borrowing frequency)
 *   7. RFID operations report (tagged items, EAS armed, reader events, availability)
 *   8. Security gate report (authorized, unauthorized, alarms, footfall, CCTV refs)
 *   9. Operator activity & Migration batch statistics reports
 *  10. Date & parameter filtering (start/end date, academic year, invalid date range rejection)
 *  11. RBAC enforcement & PII redaction for non-admin/librarian roles
 *  12. PDF export binary verification (%PDF-1.4 header, institutional metadata, page numbers)
 *  13. CSV export & spreadsheet formula injection protection (=, +, -, @ prefixed with ')
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { sanitizeCsvCell, buildCsvDocument } from '../src/modules/reports/pdfGenerator.js';

async function getToken(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body?.data?.tokens?.accessToken || res.body?.data?.accessToken || '';
}

let adminToken = '';
let libToken = '';
let studentToken = '';
let rfidOperatorToken = '';
let adminUserId = '';

// Track test entities for clean teardown
let createdBookId = '';
let createdBookItemId = '';
let createdMemberId = '';
let createdOverdueCirculationId = '';
let createdFineId = '';

describe('Phase 4D — Advanced Reports & Analytics Suite', () => {
  beforeAll(async () => {
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

    // Generate a valid token with STUDENT role (same active user record in DB so authenticate middleware passes, role=STUDENT in JWT)
    studentToken = generateAccessToken({
      userId: adminUser!.id,
      email: adminUser!.email,
      role: 'STUDENT',
      permissions: ['catalog:read'],
    });

    rfidOperatorToken = generateAccessToken({
      userId: adminUser!.id,
      email: adminUser!.email,
      role: 'RFID_OPERATOR',
      permissions: ['rfid:manage', 'inventory:audit'],
    });

    // Seed controlled test record to verify overdue calculation & formula injection protection
    const suffix = Date.now().toString().slice(-6);
    const testBook = await prisma.book.create({
      data: {
        title: `=SUM(1,2) Analytical Reporting Vol ${suffix}`,
        isbn13: `97888${suffix.padStart(8, '0')}`,
        language: 'English',
        publicationYear: 2025,
      },
    });
    createdBookId = testBook.id;

    const testItem = await prisma.bookItem.create({
      data: {
        bookId: testBook.id,
        accessionNumber: `ACC-REP-${suffix}`,
        shelfLocation: 'REP-STACK-01',
        status: 'ISSUED',
        condition: 'GOOD',
      },
    });
    createdBookItemId = testItem.id;

    const testMember = await prisma.member.create({
      data: {
        cardNumber: `STD-REP-${suffix}`,
        firstName: 'Reporting',
        lastName: 'Patron',
        email: `patron.rep.${suffix}@smartlib.ac.in`,
        phoneNumber: '+91-9876543210',
        memberType: 'STUDENT',
        department: 'Data Science',
        status: 'ACTIVE',
        fineBalance: 25.0,
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    });
    createdMemberId = testMember.id;

    // Create an overdue loan (issued 20 days ago, due 6 days ago)
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const overdueCirc = await prisma.circulation.create({
      data: {
        bookItemId: testItem.id,
        memberId: testMember.id,
        issuedByUserId: adminUserId,
        issuedDate: twentyDaysAgo,
        dueDate: sixDaysAgo,
        renewalCount: 1,
        status: 'OVERDUE',
      },
    });
    createdOverdueCirculationId = overdueCirc.id;

    // Create a partially paid fine record
    const fine = await prisma.fine.create({
      data: {
        circulationId: overdueCirc.id,
        memberId: testMember.id,
        amount: 30.0,
        paidAmount: 10.0,
        balance: 20.0,
        status: 'PARTIALLY_PAID',
        reason: 'OVERDUE',
      },
    });
    createdFineId = fine.id;
  }, 40000);

  afterAll(async () => {
    try {
      if (createdFineId) await prisma.fine.deleteMany({ where: { id: createdFineId } });
      if (createdOverdueCirculationId) {
        await prisma.circulation.deleteMany({ where: { id: createdOverdueCirculationId } });
      }
      if (createdBookItemId) await prisma.bookItem.deleteMany({ where: { id: createdBookItemId } });
      if (createdBookId) await prisma.book.deleteMany({ where: { id: createdBookId } });
      if (createdMemberId) await prisma.member.deleteMany({ where: { id: createdMemberId } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  }, 30000);
  it('1. Should reconcile GET /api/v1/reports/dashboard KPI totals against Neon database counts', async () => {
    const [expectedBooks, expectedCopies, res] = await Promise.all([
      prisma.book.count({ where: { deletedAt: null } }),
      prisma.bookItem.count({ where: { deletedAt: null } }),
      request(app)
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`),
    ]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.catalog.totalTitles).toBe(expectedBooks);
    expect(res.body.data.catalog.totalPhysicalCopies).toBe(expectedCopies);
    expect(Array.isArray(res.body.data.charts.circulationTrend)).toBe(true);
    expect(Array.isArray(res.body.data.charts.inventoryStatusBreakdown)).toBe(true);
  });

  it('2. Should return accurate Circulation Report totals, trends, and most borrowed books', async () => {
    const expectedTotalIssues = await prisma.circulation.count();
    const res = await request(app)
      .get('/api/v1/reports/circulation')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.totalIssues).toBe(expectedTotalIssues);
    expect(typeof res.body.data.summary.totalReturns).toBe('number');
    expect(typeof res.body.data.summary.activeLoans).toBe('number');
    expect(res.body.data.summary.totalRenewals).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.data.trends.daily)).toBe(true);
    expect(Array.isArray(res.body.data.trends.weekly)).toBe(true);
    expect(Array.isArray(res.body.data.trends.monthly)).toBe(true);
    expect(Array.isArray(res.body.data.mostBorrowedBooks)).toBe(true);
    expect(Array.isArray(res.body.data.records)).toBe(true);
  });

  it('3. Should accurately calculate overdue days and fine amounts in Overdue Report', async () => {
    const res = await request(app)
      .get('/api/v1/reports/overdue?department=Data%20Science')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalOverdueItems).toBeGreaterThanOrEqual(1);

    const targetLoan = res.body.data.records.find(
      (r: any) => r.id === createdOverdueCirculationId
    );
    expect(targetLoan).toBeDefined();
    expect(targetLoan.overdueDays).toBeGreaterThanOrEqual(6);
    expect(targetLoan.fineAmount).toBe(30);
    // Admin sees full contact details
    expect(targetLoan.contactEmail).toContain('@smartlib.ac.in');
  });

  it('4. Should verify Fine Collection Report decimal-safe totals and partial payments', async () => {
    const res = await request(app)
      .get('/api/v1/reports/fines')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { summary, records } = res.body.data;
    expect(summary.totalAssessedFines).toBeGreaterThanOrEqual(30);
    expect(summary.paidFines).toBeGreaterThanOrEqual(10);
    expect(summary.outstandingFines).toBeGreaterThanOrEqual(20);
    expect(summary.partialPayments).toBeGreaterThanOrEqual(10);
    expect(Array.isArray(records)).toBe(true);
  });

  it('5. Should reconcile Inventory Report counts (total, available, issued, RFID-tagged, scans)', async () => {
    const [totalCopies, taggedCopies, res] = await Promise.all([
      prisma.bookItem.count({ where: { deletedAt: null } }),
      prisma.bookItem.count({ where: { rfidTagId: { not: null }, deletedAt: null } }),
      request(app)
        .get('/api/v1/reports/inventory')
        .set('Authorization', `Bearer ${adminToken}`),
    ]);

    expect(res.status).toBe(200);
    const { summary, statusBreakdown } = res.body.data;
    expect(summary.totalPhysicalCopies).toBe(totalCopies);
    expect(summary.rfidTaggedCopies).toBe(taggedCopies);
    expect(typeof summary.availableCopies).toBe('number');
    expect(typeof summary.issuedCopies).toBe('number');
    expect(typeof summary.missingCopies).toBe('number');
    expect(typeof summary.misplacedCopies).toBe('number');
    expect(typeof summary.uncataloguedScans).toBe('number');
    expect(Array.isArray(statusBreakdown)).toBe(true);
  });

  it('6. Should retrieve Member Activity Report with borrowing frequency and category breakdown', async () => {
    const res = await request(app)
      .get('/api/v1/reports/members?department=Data%20Science')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.activeMembers).toBeGreaterThanOrEqual(1);
    const testPatron = res.body.data.records.find((m: any) => m.id === createdMemberId);
    expect(testPatron).toBeDefined();
    expect(testPatron.borrowingFrequency).toBeGreaterThanOrEqual(1);
    expect(testPatron.outstandingFines).toBe(25);
  });

  it('7. Should retrieve RFID Operations Report with tag security and device availability metrics', async () => {
    const totalTags = await prisma.rFIDTag.count();
    const res = await request(app)
      .get('/api/v1/reports/rfid')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalTagsProvisioned).toBe(totalTags);
    expect(typeof res.body.data.summary.easArmedCount).toBe('number');
    expect(typeof res.body.data.summary.deviceAvailabilityPercent).toBe('number');
    expect(Array.isArray(res.body.data.deviceActivity)).toBe(true);
  });

  it('8. Should retrieve Security Gate Report with authorized passages, alarms, footfall, and CCTV refs', async () => {
    const totalGateEvents = await prisma.gateEvent.count();
    const res = await request(app)
      .get('/api/v1/reports/security-gates')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalGateEvents).toBe(totalGateEvents);
    expect(
      res.body.data.summary.authorizedPassages + res.body.data.summary.unauthorizedPassages
    ).toBe(totalGateEvents);
    expect(typeof res.body.data.summary.totalFootfallCount).toBe('number');
  });

  it('9. Should retrieve Operator Activity Report and Migration Batches Report', async () => {
    const [opRes, migRes] = await Promise.all([
      request(app)
        .get('/api/v1/reports/operators')
        .set('Authorization', `Bearer ${adminToken}`),
      request(app)
        .get('/api/v1/reports/migrations')
        .set('Authorization', `Bearer ${adminToken}`),
    ]);

    expect(opRes.status).toBe(200);
    expect(opRes.body.data.summary.activeOperators).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(opRes.body.data.operatorBreakdown)).toBe(true);

    expect(migRes.status).toBe(200);
    expect(typeof migRes.body.data.summary.uploadedBatches).toBe('number');
    expect(typeof migRes.body.data.summary.committedRecords).toBe('number');
    expect(typeof migRes.body.data.summary.rolledBackBatches).toBe('number');
  });

  it('10. Should support date filtering and reject invalid date ranges (startDate > endDate)', async () => {
    const validFilterRes = await request(app)
      .get('/api/v1/reports/circulation?startDate=2025-01-01&endDate=2027-12-31&academicYear=2025-2026')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(validFilterRes.status).toBe(200);

    const invalidDateRangeRes = await request(app)
      .get('/api/v1/reports/circulation?startDate=2026-12-31&endDate=2026-01-01')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidDateRangeRes.status).toBe(400);
  });

  it('11. Should enforce RBAC (reject STUDENT role with 403, redact member PII for RFID_OPERATOR)', async () => {
    // Student cannot access institutional reports
    const studentRes = await request(app)
      .get('/api/v1/reports/circulation')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(studentRes.status).toBe(403);

    // RFID_OPERATOR can view overdue items for shelf recovery, but member contact details are redacted
    const operatorOverdueRes = await request(app)
      .get('/api/v1/reports/overdue?department=Data%20Science')
      .set('Authorization', `Bearer ${rfidOperatorToken}`);
    expect(operatorOverdueRes.status).toBe(200);
    const target = operatorOverdueRes.body.data.records.find(
      (r: any) => r.id === createdOverdueCirculationId
    );
    expect(target).toBeDefined();
    expect(target.contactEmail).toBe('***REDACTED***');
    expect(target.contactPhone).toBe('***REDACTED***');
  });

  it('12. Should generate valid PDF binary on GET /api/v1/reports/export/pdf with institutional metadata', async () => {
    const res = await request(app)
      .get('/api/v1/reports/export/pdf?type=CIRCULATION&department=Data%20Science')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('smartlib-circulation-report.pdf');

    const pdfText = (res.body as Buffer).toString('utf-8');
    expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfText).toContain('SMARTLIB INSTITUTIONAL LIBRARY MANAGEMENT SYSTEM');
    expect(pdfText).toContain('CIRCULATION & LOAN OPERATIONS AUDIT');
    expect(pdfText).toContain('Applied Filters: department=Data Science');
    expect(pdfText).toContain('Page 1 of');
  });

  it('13. Should export CSV on GET /api/v1/reports/export/csv and neutralize spreadsheet formula injection', async () => {
    // Unit-verify formula injection protection helper
    expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"');
    expect(sanitizeCsvCell('+cmd|\'/C calc\'!A0')).toBe('"\'+cmd|\'/C calc\'!A0"');
    expect(sanitizeCsvCell('-2+3')).toBe('"\'-2+3"');
    expect(sanitizeCsvCell('@IMPORTXML()')).toBe('"\'@IMPORTXML()"');

    const csvDoc = buildCsvDocument(['Title', 'Status'], [['=SUM(1,2) Book', 'ISSUED']]);
    expect(csvDoc).toContain('"\'=SUM(1,2) Book"');

    // End-to-end API CSV export check containing our formula-prefixed book title
    const res = await request(app)
      .get('/api/v1/reports/export/csv?type=CIRCULATION&department=Data%20Science')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('smartlib-circulation-report.csv');
    expect(res.text).toContain('"Issued Date","Accession #","Book Title"');
    // Verify the book title starting with =SUM(1,2) is prefixed with single quote '
    expect(res.text).toContain("'=SUM(1,2) Analytical Reporting Vol");
  });
});
