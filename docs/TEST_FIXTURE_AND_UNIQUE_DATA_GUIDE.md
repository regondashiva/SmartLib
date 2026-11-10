# SmartLib v1.6.0 — Test Fixture & Unique Data Generation Guide

## 1. Overview & Purpose

In enterprise library automation systems, core entities are governed by strict mathematical and relational uniqueness constraints:
- **ISBN-13**: 13-digit identifier governed by **ISO 2108:2017** with a weighted mod-10 check-digit algorithm.
- **Accession Number**: Unique physical copy inventory identifier (e.g., `ACC-2026-00001`).
- **Barcode**: Unique Code-128B copy identifier (e.g., `BC-2026-00001`).
- **RFID EPC**: 96-bit / 24-character hexadecimal electronic product code conforming to EPC Gen 2 / ISO 18000-6C.
- **Smart Card UID**: Unique contactless RFID patron token (e.g., `SC-179427...`).
- **Patron Card Number & Email**: Unique institutional patron credentials.

Hardcoding static values (e.g. `9780132350884` or `ACC-TST-001`) causes cascading test failures when tests run sequentially or repeatedly against a persistent database. SmartLib provides high-performance, collision-free generators in `backend/tests/fixtures/`.

---

## 2. Mathematically Valid ISBN-13 Algorithm (ISO 2108)

The ISBN-13 check digit calculation is standardized by ISO 2108 as follows:

$$\text{Check Digit} = \left( 10 - \left( \sum_{i=1}^{12} d_i \cdot w_i \pmod{10} \right) \right) \pmod{10}$$

Where weights $w_i$ alternate between $1$ (for odd indices) and $3$ (for even indices):

$$w = [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]$$

### Implementation (`backend/tests/fixtures/isbn-generator.ts`)

```typescript
import { randomBytes } from 'node:crypto';

export function calculateIsbn13CheckDigit(first12Digits: string): number {
  if (!/^\d{12}$/.test(first12Digits)) {
    throw new Error(`Expected exactly 12 numeric digits, received: "${first12Digits}"`);
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(first12Digits[i]!, 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

export function validateIsbn13(isbn: string): boolean {
  const clean = isbn.replace(/[-\s]/g, '');
  if (!/^\d{13}$/.test(clean)) return false;
  const first12 = clean.slice(0, 12);
  const check = parseInt(clean[12]!, 10);
  return calculateIsbn13CheckDigit(first12) === check;
}

export function generateValidUniqueTestIsbn(prefix: '978' | '979' = '978'): string {
  const randomSuffix = randomBytes(5).readUInt32BE(0).toString().padStart(9, '0').slice(-9);
  const first12 = `${prefix}${randomSuffix}`;
  const checkDigit = calculateIsbn13CheckDigit(first12);
  return `${first12}${checkDigit}`;
}
```

---

## 3. Factory Generator Reference (`backend/tests/fixtures/test-factories.ts`)

| Generator Function | Return Format | Example Output | Purpose |
| :--- | :--- | :--- | :--- |
| `generateValidUniqueTestIsbn()` | 13-digit numeric | `9780829143924` | Valid ISO 2108 ISBN-13 for cataloguing & migration. |
| `generateTestSuffix()` | 8-character numeric | `54289012` | High-entropy suffix combining timestamp and random offset. |
| `generateUniqueEmail(prefix)` | String email | `p4.patron.54289012@smartlib.edu` | Collision-free user & patron institutional emails. |
| `generateUniqueCardNumber(prefix)` | String ID | `MEM-P5-54289012` | Collision-free patron barcode/card numbers. |
| `generateUniqueSmartCardUid()` | Hex token | `SC-54289012-A1B2` | ISO 14443A Mifare/NFC smart card identifiers. |
| `generateUniqueAccessionNumber()` | String accession | `ACC-TST-54289012` | Non-colliding physical copy inventory codes. |
| `generateUniqueBarcode()` | String barcode | `BC-54289012-001` | Non-colliding Code-128 physical copy barcodes. |
| `generateUniqueEpc()` | 24-char hex | `E20000172211542890120101` | EPC Gen 2 / ISO 18000-6C RFID transponder tags. |
| `generateUniqueTid()` | 24-char hex | `E28011052000542890120101` | Factory-locked Transponder Identifier (TID). |
| `createTestBookPayload()` | JSON Object | `{ title: ..., isbn13: ... }` | Complete payload for `POST /api/v1/books`. |

---

## 4. Usage Patterns in Test Suites

### Pattern 1: Creating Unique Books & Physical Copies
```typescript
import { generateValidUniqueTestIsbn, generateTestSuffix } from './fixtures/test-factories.js';

const suffix = generateTestSuffix();
const isbn = generateValidUniqueTestIsbn();

const res = await request(app)
  .post('/api/v1/books')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    title: `Scalable Systems Architecture ${suffix}`,
    isbn13: isbn,
    copiesCount: 2,
    shelfLocation: `STACK-${suffix}`,
  });
```

### Pattern 2: Dedicated Isolated Test Patrons
```typescript
import {
  generateUniqueEmail,
  generateUniqueCardNumber,
  generateUniqueSmartCardUid,
} from './fixtures/test-factories.js';

let memberId: string;

beforeAll(async () => {
  const member = await prisma.member.create({
    data: {
      firstName: 'Test',
      lastName: 'Patron',
      email: generateUniqueEmail('suite.patron'),
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
});

afterAll(async () => {
  try {
    await prisma.circulation.deleteMany({ where: { memberId } });
    await prisma.fine.deleteMany({ where: { memberId } });
    await prisma.member.deleteMany({ where: { id: memberId } });
  } catch {}
});
```

