/**
 * Phase 4C — Enterprise Data Migration Suite Integration Tests
 * Tests against real Neon PostgreSQL database via Prisma
 *
 * Covers:
 *   1. CSV upload and batch staging with column alias resolution
 *   2. XLSX upload and batch staging
 *   3. Unsupported file type rejection (HTTP 400)
 *   4. Validation engine: detection of missing titles, invalid ISBNs, intra-batch duplicates
 *   5. Validation error retrieval (JSON) and CSV export
 *   6. Non-destructive dry-run projection (books, copies, authors, publishers, categories)
 *   7. Staging record preview pagination
 *   8. RBAC protection: non-admin (librarian) cannot commit or rollback (HTTP 403)
 *   9. Chunked commit to production catalog (creating Books, BookItems, Authors, Publishers, Categories)
 *   10. Duplicate commit prevention (HTTP 409)
 *   11. Rollback protection: blocked when an item has an active loan (HTTP 409)
 *   12. Safe rollback: clean removal of committed entities, batch status ROLLED_BACK
 *   13. Batch listing and metadata retrieval
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import * as XLSX from 'xlsx';
import { generateValidUniqueTestIsbn, generateTestSuffix } from './fixtures/test-factories.js';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function getToken(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body?.data?.tokens?.accessToken || res.body?.data?.accessToken || '';
}

let adminToken = '';
let libToken = '';

// Track batches created during tests for cleanup
const testBatchIds: string[] = [];

const suffix = generateTestSuffix();
const isbn1 = generateValidUniqueTestIsbn();
const isbn2 = generateValidUniqueTestIsbn();
const acc1 = `ACC-P4C-${suffix}-001`;
const acc2 = `ACC-P4C-${suffix}-002`;

beforeAll(async () => {
  adminToken = await getToken('admin@smartlib.ac.in', 'Admin@SmartLib2026!');
  libToken   = await getToken('librarian@smartlib.ac.in', 'Lib@SmartLib2026!');
  if (!adminToken) {
    adminToken = await getToken('admin@smartlib.institution.edu', 'AdminPassword123!');
  }
  if (!libToken) {
    libToken = adminToken;
  }
  expect(adminToken).toBeTruthy();
}, 30000);

afterAll(async () => {
  // Clean up any test batches and staging records created
  for (const batchId of testBatchIds) {
    try {
      await prisma.migrationStagingRecord.deleteMany({ where: { batchId } });
      await prisma.migrationBatch.deleteMany({ where: { id: batchId } });
    } catch {
      // Ignore cleanup errors
    }
  }
  try {
    const books = await prisma.book.findMany({
      where: { isbn13: { in: [isbn1, isbn2] } },
      include: { copies: true },
    });
    for (const b of books) {
      await prisma.circulation.deleteMany({ where: { bookItemId: { in: b.copies.map((c) => c.id) } } });
      await prisma.bookItem.deleteMany({ where: { bookId: b.id } });
      await prisma.bookAuthor.deleteMany({ where: { bookId: b.id } });
      await prisma.book.delete({ where: { id: b.id } });
    }
  } catch {
    // Ignore cleanup errors
  }
  await prisma.$disconnect();
}, 30000);

describe('Phase 4C — Data Migration Suite Integration Tests', () => {
  let validBatchId = '';
  let mixedBatchId = '';

  // 1. CSV Upload & Alias Mapping
  it('1. Should upload a CSV file and stage records with automatic alias mapping', async () => {
    const csvContent = [
      'Book_Title,ISBN_NO,Author_Name,Publisher_House,Genre,Publish_Year,Shelf,Num_Copies,Accession_No',
      `The Clean Coder ${suffix},${isbn1},Robert C. Martin,Prentice Hall,Software Engineering,2011,TECH-A1,2,${acc1}`,
      `Refactoring ${suffix},${isbn2},Martin Fowler,Addison-Wesley,Software Engineering,1999,TECH-A2,1,${acc2}`,
    ].join('\n');

    const res = await request(app)
      .post('/api/v1/migrations/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from(csvContent, 'utf-8'), 'legacy_books.csv');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.batchId).toBeDefined();
    expect(res.body.data.totalRecords).toBe(2);
    expect(res.body.data.status).toBe('UPLOADED');

    validBatchId = res.body.data.batchId || res.body.data.batch?.id;
    expect(validBatchId).toBeDefined();
    testBatchIds.push(validBatchId);

    // Verify staging records stored in DB with rawPayload
    const stagingRecords = await prisma.migrationStagingRecord.findMany({
      where: { batchId: validBatchId },
    });
    expect(stagingRecords.length).toBe(2);
    expect((stagingRecords[0].rawPayload as any)._mapped?.title).toBe(`The Clean Coder ${suffix}`);
    expect((stagingRecords[0].rawPayload as any)._mapped?.isbn13).toBe(isbn1);
    expect((stagingRecords[0].rawPayload as any)._mapped?.authors).toBe('Robert C. Martin');
    expect(Number((stagingRecords[0].rawPayload as any)._mapped?.copiesCount)).toBe(2);
  });

  // 2. XLSX Upload
  it('2. Should upload an XLSX spreadsheet and parse rows into staging records', async () => {
    const xlsxIsbn = generateValidUniqueTestIsbn();
    const data = [
      {
        'Title': `Design Patterns ${suffix}`,
        'ISBN': xlsxIsbn,
        'Authors': 'Erich Gamma; Richard Helm; Ralph Johnson; John Vlissides',
        'Publisher': 'Addison-Wesley',
        'Category': 'Computer Science',
        'Year': 1994,
        'Shelf': 'CS-01',
        'Copies': 1,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Books');
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const res = await request(app)
      .post('/api/v1/migrations/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', xlsxBuffer, 'books_batch.xlsx');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalRecords).toBe(1);

    testBatchIds.push(res.body.data.batchId || res.body.data.batch?.id);
  });

  // 3. Unsupported File Type Rejection
  it('3. Should reject unsupported file formats with HTTP 400', async () => {
    const res = await request(app)
      .post('/api/v1/migrations/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('console.log("malicious");'), 'hack.js');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // 4. Staging with Validation Errors & Intra-Batch Collision
  it('4. Should detect validation errors (missing title, invalid ISBN, intra-batch duplicate ISBN)', async () => {
    const missingTitleIsbn = generateValidUniqueTestIsbn();
    const collisionIsbn = generateValidUniqueTestIsbn();
    const dupAcc = `ACC-DUP-${suffix}`;
    const csvContent = [
      'title,isbn,author,copies,accessionNumber',
      `,${missingTitleIsbn},Uncle Bob,1,ACC-X-01-${suffix}`,                       // Missing title
      `Invalid ISBN Book,12345,Author B,1,ACC-X-02-${suffix}`,               // Invalid ISBN
      `Valid Book One,${collisionIsbn},Martin Fowler,1,${dupAcc}`,   // Valid
      `Colliding Book,${collisionIsbn},Another Author,1,${dupAcc}`,  // Duplicate ISBN & Duplicate Accession in batch
    ].join('\n');

    const uploadRes = await request(app)
      .post('/api/v1/migrations/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from(csvContent, 'utf-8'), 'mixed_validation.csv');

    expect(uploadRes.status).toBe(201);
    mixedBatchId = uploadRes.body.data.batchId || uploadRes.body.data.batch?.id;
    testBatchIds.push(mixedBatchId);

    // Run Validation
    const valRes = await request(app)
      .post(`/api/v1/migrations/${mixedBatchId}/validate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(valRes.status).toBe(200);
    expect(valRes.body.success).toBe(true);
    expect(valRes.body.data.totalRecords).toBe(4);
    expect(valRes.body.data.validRecords).toBe(1);
    expect(valRes.body.data.errorRecords).toBe(3);
    expect(valRes.body.data.status).toBe('VALIDATED');
  });

  // 5. Validation Error Reporting & CSV Export
  it('5. Should retrieve structured error logs and CSV error export', async () => {
    const errorJsonRes = await request(app)
      .get(`/api/v1/migrations/${mixedBatchId}/errors`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(errorJsonRes.status).toBe(200);
    expect(errorJsonRes.body.success).toBe(true);
    expect(errorJsonRes.body.data.errors.length).toBe(3);
    expect(errorJsonRes.body.data.errors[0].rowNumber).toBeDefined();
    expect(errorJsonRes.body.data.errors[0].validationErrors.length).toBeGreaterThan(0);

    const errorCsvRes = await request(app)
      .get(`/api/v1/migrations/${mixedBatchId}/errors/export`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(errorCsvRes.status).toBe(200);
    expect(errorCsvRes.headers['content-type']).toContain('text/csv');
    expect(errorCsvRes.text).toContain('Row,Field,Error,Raw Data');
  });

  // 6. Non-Destructive Dry Run
  it('6. Should execute non-destructive dry-run calculating entity projection metrics', async () => {
    // Validate the valid batch first
    await request(app)
      .post(`/api/v1/migrations/${validBatchId}/validate`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Dry Run
    const dryRunRes = await request(app)
      .post(`/api/v1/migrations/${validBatchId}/dry-run`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.success).toBe(true);
    expect(dryRunRes.body.data.status).toBe('DRY_RUN_COMPLETED');
    expect(dryRunRes.body.data.dryRunSummary).toBeDefined();

    const summary = dryRunRes.body.data.dryRunSummary || dryRunRes.body.data.summary;
    expect(summary.sourceRecordCount).toBe(2);
    expect(summary.validRecordCount).toBe(2);
    expect(summary.estimatedNewBooks).toBe(2);
    expect(summary.estimatedNewCopies).toBe(3); // 2 copies + 1 copy = 3
    expect(summary.estimatedAuthors).toBeGreaterThanOrEqual(2);
  });

  // 7. Preview Pagination
  it('7. Should preview staged records with pagination and status filters', async () => {
    const res = await request(app)
      .get(`/api/v1/migrations/${validBatchId}/preview?page=1&limit=10&status=VALID`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.records.length).toBe(2);
    expect(res.body.data.pagination.total).toBe(2);
  });

  // 8. RBAC Protection on Commit/Rollback
  it('8. Should reject non-admin (Librarian) attempting to commit or rollback with HTTP 403', async () => {
    const commitRes = await request(app)
      .post(`/api/v1/migrations/${validBatchId}/commit`)
      .set('Authorization', `Bearer ${libToken}`);

    expect(commitRes.status).toBe(403);

    const rollbackRes = await request(app)
      .post(`/api/v1/migrations/${validBatchId}/rollback`)
      .set('Authorization', `Bearer ${libToken}`);

    expect(rollbackRes.status).toBe(403);
  });

  // 9. Chunked Production Commit
  it('9. Should commit valid records to production catalog and assign accession numbers', async () => {
    const commitRes = await request(app)
      .post(`/api/v1/migrations/${validBatchId}/commit`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(commitRes.status).toBe(200);
    expect(commitRes.body.success).toBe(true);
    expect(commitRes.body.data.status).toBe('COMMITTED');
    expect(commitRes.body.data.migratedRecords).toBe(2);

    // Verify records exist in database
    const createdBook = await prisma.book.findUnique({
      where: { isbn13: isbn1 },
      include: { copies: true, authors: { include: { author: true } }, publisher: true },
    });

    expect(createdBook).not.toBeNull();
    expect(createdBook?.title).toBe(`The Clean Coder ${suffix}`);
    expect(createdBook?.copies.length).toBe(2);
    expect(createdBook?.copies[0].accessionNumber).toBeDefined();
    expect(createdBook?.publisher?.name).toBe('Prentice Hall');
  });

  // 10. Duplicate Commit Prevention
  it('10. Should reject duplicate commit on an already COMMITTED batch with HTTP 409', async () => {
    const res = await request(app)
      .post(`/api/v1/migrations/${validBatchId}/commit`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  // 11. Rollback Protection Against Active Loans
  it('11. Should reject rollback if any item from the batch has an active loan (HTTP 409)', async () => {
    // Find an item from validBatchId
    const book = await prisma.book.findUnique({
      where: { isbn13: isbn1 },
      include: { copies: true },
    });
    expect(book).not.toBeNull();
    const item = book!.copies[0];

    // Find a test member and admin user
    const member = await prisma.member.findFirst({ where: { status: 'ACTIVE' } });
    expect(member).not.toBeNull();
    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@smartlib.ac.in' } });
    expect(adminUser).not.toBeNull();

    // Create an active circulation record for this item
    const circulation = await prisma.circulation.create({
      data: {
        bookItem: { connect: { id: item.id } },
        member: { connect: { id: member!.id } },
        issuedByUser: { connect: { id: adminUser!.id } },
        status: 'ACTIVE',
        issuedDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    // Attempt rollback - must fail with 409
    const rollbackRes = await request(app)
      .post(`/api/v1/migrations/${validBatchId}/rollback`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(rollbackRes.status).toBe(409);
    expect(rollbackRes.body.message).toContain('active loan');

    // Clean up circulation record for next test
    await prisma.circulation.delete({ where: { id: circulation.id } });
  });

  // 12. Safe Rollback
  it('12. Should safely roll back batch, removing created items and books', async () => {
    const rollbackRes = await request(app)
      .post(`/api/v1/migrations/${validBatchId}/rollback`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(rollbackRes.status).toBe(200);
    expect(rollbackRes.body.success).toBe(true);
    expect(rollbackRes.body.data.status).toBe('ROLLED_BACK');

    // Verify books created in the batch are removed
    const book1 = await prisma.book.findUnique({ where: { isbn13: isbn1 } });
    const book2 = await prisma.book.findUnique({ where: { isbn13: isbn2 } });
    expect(book1).toBeNull();
    expect(book2).toBeNull();
  });

  // 13. Migration Batches History
  it('13. Should retrieve list of migration batches with total records and statuses', async () => {
    const res = await request(app)
      .get('/api/v1/migrations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const batches = res.body.data.batches || res.body.data.items || (Array.isArray(res.body.data) ? res.body.data : []);
    expect(Array.isArray(batches)).toBe(true);
    expect(batches.length).toBeGreaterThanOrEqual(2);
  });
});
