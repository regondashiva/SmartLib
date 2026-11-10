import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Library Business Rules & Domain Endpoints', () => {
  let librarianToken: string;
  let referenceItemId: string;
  let circulatingItemId: string;
  let memberId: string;

  beforeAll(async () => {
    // Authenticate as Librarian
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'librarian@smartlib.institution.edu',
      password: 'LibrarianPassword123!',
    });
    librarianToken = loginRes.body.data.tokens.accessToken;

    // Fetch reference copy and circulating copy
    const refCopy = await prisma.bookItem.findUnique({
      where: { accessionNumber: 'ACC-2026-00002' },
    });
    referenceItemId = refCopy!.id;

    const circCopy = await prisma.bookItem.findUnique({
      where: { accessionNumber: 'ACC-2026-00001' },
    });
    circulatingItemId = circCopy!.id;

    // Reset test loan & copy status so tests are idempotent
    await prisma.circulation.deleteMany({
      where: { bookItemId: circCopy!.id },
    });
    await prisma.bookItem.update({
      where: { id: circCopy!.id },
      data: { status: 'AVAILABLE' },
    });
    if (circCopy!.rfidTagId) {
      await prisma.rFIDTag.update({
        where: { id: circCopy!.rfidTagId },
        data: { easArmed: true },
      });
    }

    const member = await prisma.member.findUnique({
      where: { cardNumber: 'STD-2026-1001' },
    });
    memberId = member!.id;
  });

  it('GET /api/v1/books should list bibliographic catalog with physical copy breakdown', async () => {
    const res = await request(app).get('/api/v1/books?limit=100');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const cleanCode = res.body.data.find(
      (b: { isbn13: string }) => b.isbn13 === '9780132350884'
    );
    expect(cleanCode).toBeDefined();
    expect(cleanCode.title).toContain('Clean Code');
    expect(cleanCode.copiesCount.total).toBe(2);
    expect(cleanCode.copiesCount.reference).toBe(1);
    expect(cleanCode.copiesCount.available).toBe(1);
  });

  it('GET /api/v1/members should list registered members with active loan counts', async () => {
    const res = await request(app)
      .get('/api/v1/members')
      .set('Authorization', `Bearer ${librarianToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const alex = res.body.data.find(
      (m: { cardNumber: string }) => m.cardNumber === 'STD-2026-1001'
    );
    expect(alex).toBeDefined();
    expect(alex.smartCardUid).toBe('CARD-UID-9901A');
    expect(alex.maxBorrowLimit).toBe(4);
  });

  it('GET /api/v1/members/card/:uid should look up patron instantly via Smart Card UID', async () => {
    const res = await request(app)
      .get('/api/v1/members/card/CARD-UID-9901A')
      .set('Authorization', `Bearer ${librarianToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cardNumber).toBe('STD-2026-1001');
    expect(res.body.data.firstName).toBe('Alex');
  });

  it('CRITICAL RULE: Should strictly reject checkout of Reference-Only book (400 ValidationError)', async () => {
    const res = await request(app)
      .post('/api/v1/circulation/issue')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        memberId,
        bookItemId: referenceItemId,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Non-Circulating Reference Material');
  });

  it('Should successfully checkout circulating book copy and disarm EAS bit', async () => {
    const res = await request(app)
      .post('/api/v1/circulation/issue')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        memberId,
        bookItemId: circulatingItemId,
        dueDays: 14,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ACTIVE');

    // Verify in database that bookItem status is now ISSUED
    const updatedItem = await prisma.bookItem.findUnique({
      where: { id: circulatingItemId },
      include: { rfidTag: true },
    });
    expect(updatedItem?.status).toBe('ISSUED');
    // Verify EAS bit was disarmed (easArmed = false) for portal exit
    expect(updatedItem?.rfidTag?.easArmed).toBe(false);
  });

  it('GET /api/v1/circulation should list active circulation transaction', async () => {
    const res = await request(app)
      .get('/api/v1/circulation')
      .set('Authorization', `Bearer ${librarianToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const loan = res.body.data.find(
      (c: { item: { accessionNumber: string } }) =>
        c.item.accessionNumber === 'ACC-2026-00001'
    );
    expect(loan).toBeDefined();
    expect(loan.status).toBe('ACTIVE');
    expect(loan.member.cardNumber).toBe('STD-2026-1001');
  });
});

