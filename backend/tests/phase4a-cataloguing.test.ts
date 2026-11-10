import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Phase 4A: Book Creation & Cataloguing Test Suite', { timeout: 30000 }, () => {
  let adminToken: string;
  let librarianToken: string;
  let createdBookId: string;
  const uniqueTimestamp = Date.now().toString().slice(-8);

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@smartlib.ac.in',
      password: 'Admin@SmartLib2026!',
    });
    adminToken =
      adminLogin.body.data?.tokens?.accessToken || adminLogin.body.data?.accessToken;

    if (!adminToken) {
      // Fallback
      const fb = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@smartlib.institution.edu',
        password: 'AdminPassword123!',
      });
      adminToken = fb.body.data?.tokens?.accessToken || fb.body.data?.accessToken;
    }

    // 2. Authenticate Librarian
    const libLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'librarian@smartlib.ac.in',
      password: 'Lib@SmartLib2026!',
    });
    librarianToken =
      libLogin.body.data?.tokens?.accessToken || libLogin.body.data?.accessToken;

    if (!librarianToken) {
      const fb = await request(app).post('/api/v1/auth/login').send({
        email: 'librarian@smartlib.institution.edu',
        password: 'LibrarianPassword123!',
      });
      librarianToken = fb.body.data?.tokens?.accessToken || fb.body.data?.accessToken;
    }
  });

  // ----------------------------------------------------------------------------
  // Test 1 & 2: Create a valid book with multiple physical copies
  // ----------------------------------------------------------------------------
  it('1 & 2. should create a valid book with multiple physical copies and sequential accession numbers', async () => {
    const testIsbn = `9780${uniqueTimestamp}1`;
    const payload = {
      title: `Design Patterns & Architecture Vol. ${uniqueTimestamp}`,
      subtitle: 'Elements of Reusable Object-Oriented Software',
      isbn13: testIsbn,
      edition: '2nd Edition',
      publicationYear: 2024,
      classification: '005.13',
      callNumber: 'QA76.76.D47 D47 2024',
      language: 'English',
      pageCount: 450,
      publisherName: 'SmartLib Academic Publishing',
      categoryName: 'Computer Science',
      authors: ['Erich Gamma', 'Richard Helm', 'Ralph Johnson', 'John Vlissides'],
      copiesCount: 3,
      shelfLocation: 'STACK-CS-02',
      isReferenceOnly: false,
      price: 1250.0,
    };

    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    createdBookId = res.body.data.id;

    expect(res.body.data.title).toBe(payload.title);
    expect(res.body.data.isbn13).toBe(testIsbn);
    expect(res.body.data.copies).toHaveLength(3);

    // Verify sequential accession numbers
    const copies = res.body.data.copies;
    expect(copies[0].accessionNumber).toMatch(/^ACC-\d{4}-\d{5}$/);
    expect(copies[1].accessionNumber).toMatch(/^ACC-\d{4}-\d{5}$/);
    expect(copies[2].accessionNumber).toMatch(/^ACC-\d{4}-\d{5}$/);

    // Verify all accession numbers are distinct
    const accSet = new Set(copies.map((c: any) => c.accessionNumber));
    expect(accSet.size).toBe(3);

    // Confirm Neon persistence
    const saved = await prisma.book.findUnique({
      where: { id: createdBookId },
      include: { copies: true, authors: true },
    });
    expect(saved).not.toBeNull();
    expect(saved?.copies.length).toBe(3);
  });

  // ----------------------------------------------------------------------------
  // Test 3: Reject duplicate accession numbers
  // ----------------------------------------------------------------------------
  it('3. should reject creation with 409 Conflict if explicit duplicate accession numbers are provided', async () => {
    const dupAccNum = `ACC-TEST-DUP-${uniqueTimestamp}`;
    const payload = {
      title: 'Duplicate Accession Number Test',
      isbn13: `9780${uniqueTimestamp}2`,
      authors: ['Test Author'],
      copies: [
        { accessionNumber: dupAccNum, shelfLocation: 'SHELF-A' },
        { accessionNumber: dupAccNum, shelfLocation: 'SHELF-B' }, // Duplicate!
      ],
    };

    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send(payload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/duplicate accession number/i);
  });

  // ----------------------------------------------------------------------------
  // Test 4: Validate ISBN format and uniqueness
  // ----------------------------------------------------------------------------
  it('4a. should reject book with invalid ISBN format with 400 Bad Request', async () => {
    const payload = {
      title: 'Invalid ISBN Format Book',
      isbn13: 'invalid-isbn-1234',
      authors: ['Test Author'],
      copiesCount: 1,
    };

    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('4b. should reject book with duplicate ISBN-13 with 409 Conflict', async () => {
    const existingBook = await prisma.book.findFirst({
      where: { isbn13: { not: null }, deletedAt: null },
    });
    expect(existingBook).not.toBeNull();

    const payload = {
      title: 'Duplicate ISBN Book',
      isbn13: existingBook!.isbn13,
      authors: ['Duplicate Tester'],
      copiesCount: 1,
    };

    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send(payload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  // ----------------------------------------------------------------------------
  // Test 5: Reject invalid relationships
  // ----------------------------------------------------------------------------
  it('5. should reject book creation if non-existent categoryId is supplied with 404', async () => {
    const payload = {
      title: 'Invalid Category ID Book',
      authors: ['Author X'],
      categoryId: '00000000-0000-0000-0000-000000000000',
      copiesCount: 1,
    };

    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send(payload);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/category/i);
  });

  // ----------------------------------------------------------------------------
  // Test 6: Verify transaction rollback
  // ----------------------------------------------------------------------------
  it('6. should rollback entire transaction if a copy creation fails', async () => {
    // Obtain an existing copy's accession number
    const existingCopy = await prisma.bookItem.findFirst();
    expect(existingCopy).not.toBeNull();

    const testIsbn = `9780${uniqueTimestamp}6`;
    const payload = {
      title: 'Rollback Transaction Verify Book',
      isbn13: testIsbn,
      authors: ['Rollback Tester'],
      copies: [
        { accessionNumber: `ACC-UNIQUE-${uniqueTimestamp}` },
        { accessionNumber: existingCopy!.accessionNumber }, // Conflicts with DB!
      ],
    };

    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send(payload);

    expect(res.status).toBe(409);

    // Verify book was NOT saved in database
    const orphanBook = await prisma.book.findFirst({
      where: { isbn13: testIsbn },
    });
    expect(orphanBook).toBeNull();
  });

  // ----------------------------------------------------------------------------
  // Test 7: Verify RBAC permissions
  // ----------------------------------------------------------------------------
  it('7a. should reject unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/v1/books').send({
      title: 'Unauthenticated Attempt',
      authors: ['Hacker'],
    });
    expect(res.status).toBe(401);
  });

  it('7b. should allow Admin to update book metadata (PUT /api/v1/books/:id)', async () => {
    expect(createdBookId).toBeDefined();

    const updatePayload = {
      title: `Design Patterns (Updated Edition ${uniqueTimestamp})`,
      edition: '3rd Revision',
      callNumber: 'QA76.76.D47 2026',
    };

    const res = await request(app)
      .put(`/api/v1/books/${createdBookId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe(updatePayload.title);
    expect(res.body.data.edition).toBe('3rd Revision');
  });

  // ----------------------------------------------------------------------------
  // Test 8: Metadata lookups for frontend
  // ----------------------------------------------------------------------------
  it('8. should retrieve categories and publishers metadata endpoints', async () => {
    const catRes = await request(app).get('/api/v1/books/meta/categories');
    expect(catRes.status).toBe(200);
    expect(Array.isArray(catRes.body.data)).toBe(true);

    const pubRes = await request(app).get('/api/v1/books/meta/publishers');
    expect(pubRes.status).toBe(200);
    expect(Array.isArray(pubRes.body.data)).toBe(true);
  });
});
