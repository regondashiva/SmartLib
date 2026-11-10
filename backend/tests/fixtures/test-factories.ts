/**
 * Shared Test Factories & Unique Fixture Helpers
 * Generates collision-free identifiers for tests running against shared databases.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { generateValidUniqueTestIsbn, validateIsbn13 } from './isbn-generator.js';

export { generateValidUniqueTestIsbn, validateIsbn13 };

export function generateTestSuffix(): string {
  const ts = Date.now().toString().slice(-6);
  const rnd = randomBytes(3).toString('hex');
  return `${ts}${rnd}`;
}

export function generateUniqueEmail(rolePrefix = 'staff'): string {
  const unique = randomBytes(4).toString('hex');
  const ts = Date.now().toString().slice(-4);
  return `${rolePrefix}.${ts}.${unique}@test.smartlib.local`;
}

export function generateUniqueCardNumber(prefix = 'STU'): string {
  const year = new Date().getFullYear();
  const seq = randomBytes(3).readUIntBE(0, 3) % 90000 + 10000;
  return `${prefix}-${year}-${seq}`;
}

export function generateUniqueSmartCardUid(): string {
  // ISO 14443A 7-byte / 14-hex UID
  return randomBytes(7).toString('hex').toUpperCase();
}

export function generateUniqueAccessionNumber(prefix = 'ACC-TST'): string {
  const year = new Date().getFullYear();
  const seq = randomBytes(3).readUIntBE(0, 3) % 90000 + 10000;
  return `${prefix}-${year}-${seq}`;
}

export function generateUniqueBarcode(prefix = 'BC-TST'): string {
  const rnd = randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${rnd}`;
}

export function generateUniqueEpc(): string {
  // 96-bit (24-hex-char) EPC Gen2
  return `E2801160${randomBytes(8).toString('hex').toUpperCase()}`;
}

export function generateUniqueTid(): string {
  // 64-bit to 96-bit TID
  return `E2801105${randomBytes(6).toString('hex').toUpperCase()}`;
}

export function createTestBookPayload(overrides: Record<string, unknown> = {}) {
  const suffix = generateTestSuffix();
  const isbn13 = generateValidUniqueTestIsbn();
  return {
    title: `Automated Test Monograph ${suffix}`,
    subtitle: `Experimental Architecture ${suffix}`,
    isbn13,
    edition: '1st Edition',
    publicationYear: 2026,
    callNumber: `005.133 T-${suffix.slice(-4)}`,
    language: 'English',
    pageCount: 350,
    publisherName: `Test University Press ${suffix}`,
    categoryName: 'Computer Science',
    authors: [`Dr. Test Author ${suffix}`],
    copiesCount: 2,
    shelfLocation: 'MAIN-STACKS',
    isReferenceOnly: false,
    price: 750.0,
    ...overrides,
  };
}
