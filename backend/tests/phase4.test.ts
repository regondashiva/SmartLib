import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import {
  generateUniqueEmail,
  generateUniqueCardNumber,
  generateUniqueSmartCardUid,
} from './fixtures/test-factories.js';

describe('Phase 4 AISYS Gap Closure Endpoints', () => {
  afterAll(async () => {
    try {
      if (memberId) {
        await prisma.fine.deleteMany({ where: { memberId } });
        await prisma.circulation.deleteMany({ where: { memberId } });
        await prisma.member.deleteMany({ where: { id: memberId } });
      }
    } catch {
      // Ignore cleanup errors
    }
  }, 30000);

  let adminToken: string;
  let librarianToken: string;
  let memberId: string;
  let testBookCopyId: string;
  let testAccessionNumber: string;

  beforeAll(async () => {
    // Authenticate Admin
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@smartlib.institution.edu',
      password: 'AdminPassword123!',
    });
    adminToken = adminLogin.body.data.tokens.accessToken;

    // Authenticate Librarian
    const libLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'librarian@smartlib.institution.edu',
      password: 'LibrarianPassword123!',
    });
    librarianToken = libLogin.body.data.tokens.accessToken;

    // Create a dedicated active member so shared-member loan limits/fines
    // left by other suites can never affect this suite.
    const member = await prisma.member.create({
      data: {
        firstName: 'Phase4',
        lastName: 'IsolatedPatron',
        email: generateUniqueEmail('p4.patron'),
        cardNumber: generateUniqueCardNumber(),
        smartCardUid: generateUniqueSmartCardUid(),
        memberType: 'STUDENT',
        status: 'ACTIVE',
        maxBorrowLimit: 5,
        fineBalance: 0,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    memberId = member.id;

    // Ensure clean state for test circulating copy
    const circCopy = await prisma.bookItem.findFirst({
      where: { isReferenceOnly: false },
      include: { rfidTag: true },
    });
    testBookCopyId = circCopy!.id;
    testAccessionNumber = circCopy!.accessionNumber;

    await prisma.circulation.deleteMany({
      where: { bookItemId: testBookCopyId },
    });
    await prisma.bookItem.update({
      where: { id: testBookCopyId },
      data: { status: 'AVAILABLE' },
    });
    if (circCopy!.rfidTagId) {
      await prisma.rFIDTag.update({
        where: { id: circCopy!.rfidTagId },
        data: { easArmed: true },
      });
    }
  });

  // ============================================================================
  // 1. Book Creation (POST /api/v1/books)
  // ============================================================================
  describe('1. Book Creation (POST /api/v1/books)', () => {
    const testIsbn = `9780${Date.now().toString().slice(-9)}`;

    it('should allow Librarian/Admin to create a new book with multiple physical copies and sequential accession numbers', async () => {
      const payload = {
        title: 'Phase 4 Integration Systems Manual',
        subtitle: 'Enterprise Library Engineering',
        isbn13: testIsbn,
        authors: ['Dr. Alan Turing', 'Ada Lovelace'],
        publisherName: 'SmartLib Academic Press',
        categoryName: 'Computer Science',
        copiesCount: 2,
        shelfLocation: 'STACK-A-01',
        price: 899.5,
        isReferenceOnly: false,
      };

      const res = await request(app)
        .post('/api/v1/books')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe(payload.title);
      expect(res.body.data.isbn13).toBe(testIsbn);
      expect(res.body.data.copies).toHaveLength(2);
      expect(res.body.data.copies[0].accessionNumber).toMatch(/^ACC-\d{4}-\d{5}$/);
      expect(res.body.data.copies[1].accessionNumber).toMatch(/^ACC-\d{4}-\d{5}$/);
      expect(res.body.data.copies[0].accessionNumber).not.toBe(
        res.body.data.copies[1].accessionNumber
      );
    });

    it('should reject creation with 409 Conflict when ISBN-13 already exists in catalog', async () => {
      const payload = {
        title: 'Duplicate ISBN Test',
        isbn13: testIsbn,
        authors: ['Duplicate Author'],
        copiesCount: 1,
      };

      const res = await request(app)
        .post('/api/v1/books')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message || res.body.error).toContain('already exists');
    });

    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).post('/api/v1/books').send({
        title: 'Unauthorized Book',
        authors: ['Ghost Author'],
      });

      expect(res.status).toBe(401);
    });
  });

  // ============================================================================
  // 2. Circulation Return (POST /api/v1/circulation/return)
  // ============================================================================
  describe('2. Circulation Return (POST /api/v1/circulation/return)', () => {
    let activeCirculationId: string;

    beforeAll(async () => {
      // Issue book copy to member
      const issueRes = await request(app)
        .post('/api/v1/circulation/issue')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({
          memberId,
          bookItemId: testBookCopyId,
          dueDays: 14,
        });

      expect(issueRes.status).toBe(201);
      activeCirculationId = issueRes.body.data.id;
    });

    it('should return checked-out book, restore copy to AVAILABLE, and re-arm EAS security bit', async () => {
      const res = await request(app)
        .post('/api/v1/circulation/return')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({
          circulationId: activeCirculationId,
          notes: 'Returned in pristine condition at main circulation desk',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.circulation.status).toBe('RETURNED');
      expect(res.body.data.bookItem.status).toBe('AVAILABLE');
      expect(res.body.data.bookItem.easArmed).toBe(true);

      // Verify persistence in Neon
      const verifiedCopy = await prisma.bookItem.findUnique({
        where: { id: testBookCopyId },
        include: { rfidTag: true },
      });
      expect(verifiedCopy!.status).toBe('AVAILABLE');
      if (verifiedCopy!.rfidTag) {
        expect(verifiedCopy!.rfidTag.easArmed).toBe(true);
      }
    });

    it('should reject double return of already returned loan with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/circulation/return')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({
          circulationId: activeCirculationId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message || res.body.error).toContain('already been returned');
    });
  });

  // ============================================================================
  // 3. Circulation Renewal (POST /api/v1/circulation/renew)
  // ============================================================================
  describe('3. Circulation Renewal (POST /api/v1/circulation/renew)', () => {
    let renewalCirculationId: string;

    beforeAll(async () => {
      // Issue book copy
      const issueRes = await request(app)
        .post('/api/v1/circulation/issue')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({
          memberId,
          bookItemId: testBookCopyId,
          dueDays: 14,
        });

      expect(issueRes.status).toBe(201);
      renewalCirculationId = issueRes.body.data.id;
    });

    it('should successfully renew active loan and increment renewalCount to 1', async () => {
      const res = await request(app)
        .post('/api/v1/circulation/renew')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({
          circulationId: renewalCirculationId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.renewalCount).toBe(1);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should allow second renewal and increment renewalCount to 2', async () => {
      const res = await request(app)
        .post('/api/v1/circulation/renew')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({
          circulationId: renewalCirculationId,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.renewalCount).toBe(2);
    });

    it('should reject third renewal attempt with 400 Bad Request (enforce max 2 renewals)', async () => {
      const res = await request(app)
        .post('/api/v1/circulation/renew')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({
          circulationId: renewalCirculationId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message || res.body.error).toContain('Renewal limit reached');
    });

    it('should cleanup test loan by returning it', async () => {
      const res = await request(app)
        .post('/api/v1/circulation/return')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({ circulationId: renewalCirculationId });

      expect(res.status).toBe(200);
    });
  });

  // ============================================================================
  // 4. Data Migration Lifecycle & Rollback (/api/v1/migration/*)
  // ============================================================================
  describe('4. Data Migration Lifecycle (/api/v1/migration/*)', () => {
    let testBatchId: string;
    const migrationIsbn = `9781${Date.now().toString().slice(-9)}`;

    it('should create a migration batch and stage records', async () => {
      const payload = {
        batchName: 'Phase 4 Validation Test Batch',
        sourceFileName: 'catalog_migration_sample.csv',
        records: [
          {
            title: 'Cloud Native Microservices Architecture',
            authors: 'Jane Developer',
            isbn13: migrationIsbn,
            publisher: 'Tech Pubs Inc',
            category: 'Engineering',
            copiesCount: 2,
            shelfLocation: 'STACK-MIG-01',
          },
          {
            // Missing title -> Invalid record
            title: '',
            authors: 'Anonymous',
            isbn13: 'invalid-isbn-123',
          },
        ],
      };

      const res = await request(app)
        .post('/api/v1/migration/batches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalRecords).toBe(2);
      expect(res.body.data.status).toBe('UPLOADED');
      testBatchId = res.body.data.id;
    });

    it('should validate staged records and identify valid vs invalid rows', async () => {
      const res = await request(app)
        .post(`/api/v1/migration/batches/${testBatchId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.validRecords).toBe(1);
      expect(res.body.data.errorRecords).toBe(1);
      expect(res.body.data.status).toBe('VALIDATED');
    });

    it('should preview sample valid and invalid records with errors', async () => {
      const res = await request(app)
        .get(`/api/v1/migration/batches/${testBatchId}/preview`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const validCount = res.body.data.summary?.validCount ?? res.body.data.preview?.validCount;
      const errorCount = res.body.data.summary?.errorCount ?? res.body.data.preview?.errorCount;
      expect(validCount).toBe(1);
      expect(errorCount).toBe(1);
    });

    it('should execute dry run and provide simulated migration forecast', async () => {
      const res = await request(app)
        .post(`/api/v1/migration/batches/${testBatchId}/dry-run`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.estimatedNewBooks).toBe(1);
      expect(res.body.data.summary.estimatedNewCopies).toBe(2);
      expect(res.body.data.batch.status).toBe('DRY_RUN_COMPLETED');
    });

    it('should commit validated records to catalog in an atomic transaction', async () => {
      const res = await request(app)
        .post(`/api/v1/migration/batches/${testBatchId}/commit`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const committedBooks = res.body.data.reconciliation?.committedBooksCount ?? res.body.data.migratedRecords ?? res.body.data.summary?.committedBooksCount ?? res.body.data.committedBooksCount;
      const committedCopies = res.body.data.reconciliation?.committedCopiesCount ?? res.body.data.summary?.committedCopiesCount ?? res.body.data.committedCopiesCount;
      expect(committedBooks).toBe(1);
      expect(committedCopies).toBe(2);
      expect(res.body.data.batch.status).toBe('COMMITTED');

      // Verify book exists in live catalog
      const liveBook = await prisma.book.findFirst({
        where: { isbn13: migrationIsbn },
        include: { copies: true },
      });
      expect(liveBook).not.toBeNull();
      expect(liveBook!.copies).toHaveLength(2);
    });

    it('should export rejected rows as CSV error report', async () => {
      const res = await request(app)
        .get(`/api/v1/migration/batches/${testBatchId}/errors/export`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toMatch(/Row(Number)?,(Field|Title),(Error|ISBN13)/);
      expect(res.text).toContain('Title is missing or empty');
    });

    it('should safely roll back the committed batch and remove created catalog records', async () => {
      const res = await request(app)
        .post(`/api/v1/migration/batches/${testBatchId}/rollback`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.batch.status).toBe('ROLLED_BACK');
      expect(res.body.data.deletedBooksCount).toBe(1);

      // Verify book was cleanly removed
      const liveBook = await prisma.book.findFirst({
        where: { isbn13: migrationIsbn },
      });
      expect(liveBook).toBeNull();
    });
  });

  // ============================================================================
  // 5. Reports & Analytics Export (/api/v1/reports/*)
  // ============================================================================
  describe('5. Reports & Analytics Export (/api/v1/reports/*)', () => {
    it('should return institutional KPI summary metrics via GET /api/v1/reports/summary', async () => {
      const res = await request(app)
        .get('/api/v1/reports/summary')
        .set('Authorization', `Bearer ${librarianToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.catalog.totalTitles).toBeGreaterThanOrEqual(1);
      expect(res.body.data.catalog.totalPhysicalCopies).toBeGreaterThanOrEqual(1);
      expect(res.body.data.circulation).toBeDefined();
      expect(res.body.data.fines).toBeDefined();
    });

    it('should generate valid PDF report stream via GET /api/v1/reports/export?type=CIRCULATION&format=pdf', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export?type=CIRCULATION&format=pdf')
        .set('Authorization', `Bearer ${librarianToken}`)
        .buffer(true)
        .parse((res, callback) => {
          res.setEncoding('binary');
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            callback(null, Buffer.from(data, 'binary'));
          });
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      const pdfBuffer = res.body as Buffer;
      expect(pdfBuffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('should generate formatted CSV report via GET /api/v1/reports/export?type=FINES&format=csv', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export?type=FINES&format=csv')
        .set('Authorization', `Bearer ${librarianToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toMatch(/["']?Date["']?,["']?Card #["']?,["']?Member Name["']?/);
    });

    it('should generate JSON dataset via GET /api/v1/reports/export?type=RFID&format=json', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export?type=RFID&format=json')
        .set('Authorization', `Bearer ${librarianToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.title).toContain('RFID');
      expect(Array.isArray(res.body.data.metrics)).toBe(true);
    });
  });
});

