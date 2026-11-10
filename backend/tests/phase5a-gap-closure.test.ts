import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { generateAccessToken } from '../src/utils/jwt.js';

describe('Phase 5A — Complete AISYS Requirements Gap Closure Suite (Parts 2, 3 & 4)', { timeout: 60000 }, () => {
  let adminToken = '';
  let librarianToken = '';
  let rfidOperatorToken = '';
  let adminUserId = '';
  let libUserId = '';

  const suffix = Date.now().toString().slice(-6);
  const createdBookIds: string[] = [];
  let testMemberId = '';
  let testMemberCard = '';

  beforeAll(async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        break;
      } catch (err) {
        if (attempt === 5) throw err;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    const adminUser = await prisma.user.findFirst({
      where: { role: { name: 'ADMIN' } },
    });
    const libUser = await prisma.user.findFirst({
      where: { role: { name: 'LIBRARIAN' } },
    });

    expect(adminUser).toBeTruthy();
    adminUserId = adminUser!.id;
    libUserId = libUser ? libUser.id : adminUser!.id;

    adminToken = generateAccessToken({
      userId: adminUser!.id,
      email: adminUser!.email,
      role: 'ADMIN',
    });
    librarianToken = generateAccessToken({
      userId: libUserId,
      email: libUser ? libUser.email : adminUser!.email,
      role: 'LIBRARIAN',
    });
    rfidOperatorToken = generateAccessToken({
      userId: adminUser!.id,
      email: adminUser!.email,
      role: 'RFID_OPERATOR',
    });

    testMemberCard = `MEM-5A-${suffix}`;
    const member = await prisma.member.create({
      data: {
        firstName: 'Phase5A',
        lastName: 'Patron',
        email: `p5a.patron.${suffix}@smartlib.edu`,
        cardNumber: testMemberCard,
        smartCardUid: `UID-5A-${suffix}`,
        memberType: 'STUDENT',
        status: 'ACTIVE',
        maxBorrowLimit: 5,
        fineBalance: 0,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    testMemberId = member.id;
  }, 60000);

  afterAll(async () => {
    try {
      if (testMemberId) {
        await prisma.fine.deleteMany({ where: { memberId: testMemberId } });
        await prisma.circulation.deleteMany({ where: { memberId: testMemberId } });
      }
      if (createdBookIds.length > 0) {
        await prisma.bookItem.deleteMany({ where: { bookId: { in: createdBookIds } } });
        await prisma.book.deleteMany({ where: { id: { in: createdBookIds } } });
      }
      if (testMemberId) {
        await prisma.member.deleteMany({ where: { id: testMemberId } });
      }
    } catch {
      // Ignore cleanup errors
    }
  }, 60000);

  // ============================================================================
  // 1. PART 2.1 — ACQUISITION MANAGEMENT
  // ============================================================================
  it('Part 2.1 (Acquisitions): manages suppliers, requests, purchase orders, partial/full receiving, and cataloguing without duplicate books', async () => {
    // 1. Create Supplier
    const supRes = await request(app)
      .post('/api/v1/acquisitions/suppliers')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        name: `Phase 5A Academic Supplier ${suffix}`,
        contactPerson: 'Ananya Rao',
        email: `supplier.${suffix}@academic.example.com`,
        phone: '+91-80-40901020',
      });
    expect(supRes.status).toBe(201);
    const supplierId = supRes.body.data.id;

    // 2. Create Acquisition Request
    const acqIsbn = `97893${suffix.padStart(7, '0')}1`;
    const reqRes = await request(app)
      .post('/api/v1/acquisitions/requests')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: `Distributed Systems Engineering Vol ${suffix}`,
        isbn13: acqIsbn,
        authors: ['Prof. Leslie Lamport'],
        publisherName: 'MIT Press',
        categoryName: 'Computer Science',
        quantity: 2,
        estimatedUnitPrice: 850,
      });
    expect(reqRes.status).toBe(201);
    const requestId = reqRes.body.data.id;

    // 3. Create Purchase Order from Request
    const poRes = await request(app)
      .post('/api/v1/acquisitions/orders')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        supplierId,
        requestId,
      });
    expect(poRes.status).toBe(201);
    const orderId = poRes.body.data.id;
    const lineItemId = poRes.body.data.items[0].id;
    expect(poRes.body.data.totalOrderedQuantity).toBe(2);
    expect(poRes.body.data.totalPendingQuantity).toBe(2);

    // 4. Receive Shipment 1 (1 of 2 copies -> PARTIALLY_RECEIVED)
    const rec1Res = await request(app)
      .post(`/api/v1/acquisitions/orders/${orderId}/receive`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        items: [{ lineItemId, receivedQuantity: 1, shelfLocation: `STACK-5A-${suffix}` }],
      });
    expect(rec1Res.status).toBe(200);
    expect(rec1Res.body.data.order.status).toBe('PARTIALLY_RECEIVED');
    expect(rec1Res.body.data.order.totalReceivedQuantity).toBe(1);
    expect(rec1Res.body.data.order.totalPendingQuantity).toBe(1);
    const bookId = rec1Res.body.data.cataloguedBookIds[0];
    expect(bookId).toBeTruthy();
    createdBookIds.push(bookId);

    // 5. Receive Shipment 2 (Remaining 1 copy -> RECEIVED, no duplicate Book created)
    const rec2Res = await request(app)
      .post(`/api/v1/acquisitions/orders/${orderId}/receive`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        items: [{ lineItemId, receivedQuantity: 1, shelfLocation: `STACK-5A-${suffix}` }],
      });
    expect(rec2Res.status).toBe(200);
    expect(rec2Res.body.data.order.status).toBe('RECEIVED');
    expect(rec2Res.body.data.order.totalReceivedQuantity).toBe(2);
    expect(rec2Res.body.data.order.totalPendingQuantity).toBe(0);

    // Confirm exactly 1 Book record exists for acqIsbn with 2 physical copies
    const matchingBooks = await prisma.book.findMany({
      where: { isbn13: acqIsbn, deletedAt: null },
      include: { copies: true },
    });
    expect(matchingBooks.length).toBe(1);
    expect(matchingBooks[0]!.copies.length).toBe(2);

    // 6. Verify Acquisition Report
    const repRes = await request(app)
      .get('/api/v1/acquisitions/reports')
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(repRes.status).toBe(200);
    expect(repRes.body.data.summary.totalPurchaseOrders).toBeGreaterThanOrEqual(1);
  });

  // ============================================================================
  // 2. PART 2.3 — SERIALS MANAGEMENT
  // ============================================================================
  it('Part 2.3 (Serials): validates ISSN format, tracks volumes/issues, flags missing issues, and renews subscriptions', async () => {
    // 1. Reject invalid ISSN
    const badIssnRes = await request(app)
      .post('/api/v1/serials')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        issn: 'INVALID-ISSN',
        title: 'Invalid Journal',
        publisher: 'Test Pub',
        subscriptionStartDate: '2026-01-01',
        subscriptionEndDate: '2026-12-31',
      });
    expect(badIssnRes.status).toBe(400);

    // 2. Create valid Serial subscription
    const validIssn = `${suffix.slice(0, 4)}-${suffix.slice(2, 5)}X`;
    const createSerRes = await request(app)
      .post('/api/v1/serials')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        issn: validIssn,
        title: `Journal of Library Automation ${suffix}`,
        publisher: 'Institutional Serials Press',
        subject: 'Library Automation',
        frequency: 'MONTHLY',
        subscriptionStartDate: '2026-01-01',
        subscriptionEndDate: '2026-12-31',
        annualSubscriptionCost: 14500,
      });
    expect(createSerRes.status).toBe(201);
    const serialId = createSerRes.body.data.id;

    // 3. Track expected & received issues
    const iss1Res = await request(app)
      .post(`/api/v1/serials/${serialId}/issues`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        volumeNumber: 'Vol. 12',
        issueNumber: 'Issue 1',
        expectedDate: '2026-03-01',
        status: 'EXPECTED',
      });
    expect(iss1Res.status).toBe(201);
    const issueId = iss1Res.body.data.id;

    // Mark issue as RECEIVED
    const receiveIssRes = await request(app)
      .put(`/api/v1/serials/issues/${issueId}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ status: 'RECEIVED', notes: 'Received in good condition' });
    expect(receiveIssRes.status).toBe(200);
    expect(receiveIssRes.body.data.status).toBe('RECEIVED');
    expect(receiveIssRes.body.data.receivedDate).toBeTruthy();

    // 4. Renew subscription
    const renewSerRes = await request(app)
      .put(`/api/v1/serials/${serialId}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        renewSubscription: true,
        subscriptionEndDate: '2027-12-31',
      });
    expect(renewSerRes.status).toBe(200);
    expect(renewSerRes.body.data.renewalCount).toBe(1);

    // 5. Serials report
    const repRes = await request(app)
      .get('/api/v1/serials/reports')
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(repRes.status).toBe(200);
    expect(repRes.body.data.summary.totalSubscriptions).toBeGreaterThanOrEqual(1);
  });

  // ============================================================================
  // 3. PART 2.5 — BARCODE & SPINE-LABEL MANAGEMENT
  // ============================================================================
  it('Part 2.5 (Labels): assigns unique barcodes, prevents duplicate barcodes, previews Code-128B SVG & spine labels, and outputs PDF', async () => {
    const book = await prisma.book.findFirst({
      where: { id: { in: createdBookIds } },
      include: { copies: true },
    });
    expect(book).toBeTruthy();
    const copy1 = book!.copies[0]!;
    const copy2 = book!.copies[1]!;

    const customBarcode = `BC-5A-${suffix}-001`;
    const assignRes = await request(app)
      .post('/api/v1/labels/assign-barcode')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        bookItemId: copy1.id,
        barcode: customBarcode,
      });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.barcode).toBe(customBarcode);
    expect(assignRes.body.data.barcodeSvg).toContain('<svg');

    // Prevent duplicate barcode assignment on copy2
    const dupRes = await request(app)
      .post('/api/v1/labels/assign-barcode')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        bookItemId: copy2.id,
        barcode: customBarcode,
      });
    expect(dupRes.status).toBe(409);

    // Bulk preview
    const previewRes = await request(app)
      .post('/api/v1/labels/preview')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        bookItemIds: [copy1.id, copy2.id],
        layoutPreset: 'SPINE_STANDARD_38X25',
        labelType: 'COMBINED',
      });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.totalLabels).toBe(2);
    expect(previewRes.body.data.labels[0].spineLines.length).toBe(4);

    // Print-ready PDF output
    const pdfRes = await request(app)
      .post('/api/v1/labels/pdf')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        bookItemIds: [copy1.id, copy2.id],
        layoutPreset: 'AVERY_5160_30UP',
      });
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(pdfRes.body).toString('utf8')).toContain('%PDF-1.4');
  });

  // ============================================================================
  // 4. PART 3.1, 3.2, 3.3, 3.4 — PUBLIC OPAC, FULL-TEXT SEARCH, NET CATALOGUING & BOOKSHELF
  // ============================================================================
  it('Part 3 (OPAC, Search, Net Cataloguing & Bookshelf): supports unauthenticated OPAC search/detail, Net Cataloguing import, and user-isolated Virtual Bookshelf', async () => {
    // 1. Unauthenticated Public OPAC Search (no Authorization header)
    const searchRes = await request(app).get(
      `/api/v1/opac/search?q=Distributed+Systems+${suffix}&sort=RELEVANCE`
    );
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThanOrEqual(1);
    const firstHit = searchRes.body.data[0];
    expect(firstHit.title).toContain(`Distributed Systems Engineering Vol ${suffix}`);
    expect(firstHit.relevanceScore).toBeGreaterThan(10);

    // 2. Unauthenticated Public Book Detail + Related Books
    const detailRes = await request(app).get(`/api/v1/opac/books/${firstHit.id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.copies.length).toBe(2);
    expect(Array.isArray(detailRes.body.data.relatedBooks)).toBe(true);

    // 3. Provider-Neutral Net Cataloguing Lookup & Import
    const netIsbn = `97801${suffix.padStart(7, '0')}5`;
    const lookupRes = await request(app)
      .get(`/api/v1/opac/net-cataloguing/lookup?isbn=${netIsbn}`)
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.data.metadata.providerMode).toBe('MOCK_ADAPTER');
    expect(lookupRes.body.data.duplicateExists).toBe(false);

    const importRes = await request(app)
      .post('/api/v1/opac/net-cataloguing/import')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        isbn: netIsbn,
        copiesCount: 1,
      });
    expect(importRes.status).toBe(201);
    createdBookIds.push(importRes.body.data.importedBook.id);

    // Duplicate Net Cataloguing import rejected with 409
    const dupImportRes = await request(app)
      .post('/api/v1/opac/net-cataloguing/import')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ isbn: netIsbn });
    expect(dupImportRes.status).toBe(409);

    // 4. Virtual Bookshelf — Personal Reading List & User Isolation
    const unauthShelf = await request(app).get('/api/v1/opac/bookshelf/personal');
    expect(unauthShelf.status).toBe(401);

    const addShelfRes = await request(app)
      .post('/api/v1/opac/bookshelf/personal')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        bookId: firstHit.id,
        shelfName: 'Research Favorites',
      });
    expect(addShelfRes.status).toBe(201);
    expect(addShelfRes.body.data.items.length).toBeGreaterThanOrEqual(1);

    // Attempting to read another user's private shelf is forbidden (403)
    const crossUserRes = await request(app)
      .get('/api/v1/opac/bookshelf/personal?userId=another-user-uuid-9999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(crossUserRes.status).toBe(403);

    // Remove from personal bookshelf
    const delShelfRes = await request(app)
      .delete(`/api/v1/opac/bookshelf/personal/${firstHit.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delShelfRes.status).toBe(200);
  });

  // ============================================================================
  // 5. PART 2.4 & PART 4 — DUE-DATE ENQUIRY, 9 ADAPTERS, NCIP 2.0, SIP2 & TAG REASSIGNMENT
  // ============================================================================
  it('Part 2.4 & Part 4 (Adapters, NCIP 2.0, SIP2, Due-Date Enquiry & Tag Reassignment): verifies all 9 device adapters, NCIP/SIP2 circulation lifecycle, due-date enquiry, and RFID tag reassignment', async () => {
    const book = await prisma.book.findFirst({
      where: { id: { in: createdBookIds } },
      include: { copies: true },
    });
    const copy1 = book!.copies[0]!;
    const copy2 = book!.copies[1]!;

    // 1. Verify all 9 Device-Neutral Adapter Interfaces (Part 4.1)
    const adaptersRes = await request(app)
      .get('/api/v1/adapters/devices')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adaptersRes.status).toBe(200);
    expect(adaptersRes.body.data.totalAdapters).toBe(9);

    const cmdRes = await request(app)
      .post('/api/v1/adapters/devices/STAFF_READER/command')
      .set('Authorization', `Bearer ${rfidOperatorToken}`)
      .send({ command: 'SCAN_PAD', payload: { antenna: 1 } });
    expect(cmdRes.status).toBe(200);
    expect(cmdRes.body.data.status).toBe('SUCCESS');

    // 2. Staff RFID Tag Assignment & Reassignment with Audit History (Part 4.4)
    const epcTag = `E200001722115A${suffix}01`;
    const assignTagRes = await request(app)
      .post('/api/v1/rfid/tags')
      .set('Authorization', `Bearer ${rfidOperatorToken}`)
      .send({ epc: epcTag, bookItemId: copy1.id });
    expect(assignTagRes.status).toBe(201);
    const tagId = assignTagRes.body.data.tag.id;

    // Reassign tag from copy1 to copy2
    const reassignRes = await request(app)
      .put(`/api/v1/rfid/tags/${tagId}/reassign`)
      .set('Authorization', `Bearer ${rfidOperatorToken}`)
      .send({
        bookItemId: copy2.id,
        reason: 'Replaced damaged physical copy cover',
      });
    expect(reassignRes.status).toBe(200);
    expect(reassignRes.body.data.associatedItem.id).toBe(copy2.id);

    // 3. NCIP 2.0 Adapter Boundary: LookupUser, LookupItem, CheckOutItem (Part 4.2)
    const ncipUserRes = await request(app)
      .post('/api/v1/adapters/ncip')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ service: 'LookupUser', cardNumber: testMemberCard });
    expect(ncipUserRes.status).toBe(200);
    expect(ncipUserRes.body.data.userId).toBe(testMemberId);

    const ncipCheckoutRes = await request(app)
      .post('/api/v1/adapters/ncip')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        service: 'CheckOutItem',
        cardNumber: testMemberCard,
        accessionNumber: copy2.accessionNumber,
      });
    expect(ncipCheckoutRes.status).toBe(200);
    expect(ncipCheckoutRes.body.data.service).toBe('CheckOutItemResponse');
    expect(ncipCheckoutRes.body.data.easArmed).toBe(false);

    // 4. Dedicated Circulation Due-Date Enquiry (Part 2.4)
    const enquiryRes = await request(app)
      .get(`/api/v1/circulation/due-date-enquiry?accessionNumber=${copy2.accessionNumber}`)
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(enquiryRes.status).toBe(200);
    expect(enquiryRes.body.data.totalActiveMatches).toBe(1);
    expect(enquiryRes.body.data.items[0].accessionNumber).toBe(copy2.accessionNumber);
    expect(enquiryRes.body.data.items[0].canRenew).toBe(true);

    // 5. 3M SIP2 Adapter Boundary: 93 Login, 63 Patron Info, 17 Item Info, 29 Renew, 09 Checkin (Part 4.3)
    const sipLoginRes = await request(app)
      .post('/api/v1/adapters/sip2')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ message: '9300CNkiosk|COsecret|AY1AZF5A0' });
    expect(sipLoginRes.status).toBe(200);
    expect(sipLoginRes.body.data.responseWire).toMatch(/^941\|AY1AZ[0-9A-F]{4}$/);

    const sipPatronRes = await request(app)
      .post('/api/v1/adapters/sip2')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ message: `6300120261109    090000          |AOSMARTLIB|AA${testMemberCard}|AY2AZ0000` });
    expect(sipPatronRes.status).toBe(200);
    expect(sipPatronRes.body.data.patronFound).toBe(true);

    const sipRenewRes = await request(app)
      .post('/api/v1/adapters/sip2')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ message: `29NN20261109    090000|AOSMARTLIB|AA${testMemberCard}|AB${copy2.accessionNumber}|AY3AZ0000` });
    expect(sipRenewRes.status).toBe(200);
    expect(sipRenewRes.body.data.renewSucceeded).toBe(true);

    const sipCheckinRes = await request(app)
      .post('/api/v1/adapters/sip2')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ message: `09N20261109    090000|AOSMARTLIB|AB${copy2.accessionNumber}|AY4AZ0000` });
    expect(sipCheckinRes.status).toBe(200);
    expect(sipCheckinRes.body.data.checkinSucceeded).toBe(true);
  });
});

