import { describe, it, expect } from 'vitest';
import {
  calculateIsbn13CheckDigit,
  validateIsbn13,
  generateValidUniqueTestIsbn,
} from './isbn-generator.js';
import {
  generateTestSuffix,
  generateUniqueEmail,
  generateUniqueCardNumber,
  generateUniqueSmartCardUid,
  generateUniqueEpc,
  generateUniqueTid,
  createTestBookPayload,
} from './test-factories.js';

describe('Mathematically Valid ISBN-13 & Unique Fixture Generator', () => {
  it('correctly calculates check digits for standard published ISBN-13s', () => {
    // Clean Code: 9780132350884 -> first 12 digits 978013235088 -> check digit 4
    expect(calculateIsbn13CheckDigit('978013235088')).toBe(4);

    // The Pragmatic Programmer: 9780135957059 -> 978013595705 -> check digit 9
    expect(calculateIsbn13CheckDigit('978013595705')).toBe(9);

    // Refactoring: 9780201485677 -> 978020148567 -> check digit 7
    expect(calculateIsbn13CheckDigit('978020148567')).toBe(7);
  });

  it('validates authentic ISBN-13s and rejects invalid check digits', () => {
    expect(validateIsbn13('9780132350884')).toBe(true);
    expect(validateIsbn13('978-0-13-235088-4')).toBe(true);
    expect(validateIsbn13('9780132350885')).toBe(false); // Wrong check digit
    expect(validateIsbn13('12345')).toBe(false); // Invalid length
  });

  it('generates 50 consecutive unique and mathematically valid ISBN-13 values', () => {
    const isbns = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const isbn = generateValidUniqueTestIsbn();
      expect(isbn).toMatch(/^978\d{10}$/);
      expect(validateIsbn13(isbn)).toBe(true);
      isbns.add(isbn);
    }
    expect(isbns.size).toBe(50); // Zero collisions
  });

  it('generates collision-free EPC, TID, card, and email identifiers', () => {
    const epc = generateUniqueEpc();
    expect(epc).toHaveLength(24);
    expect(epc).toMatch(/^E2801160[0-9A-F]{16}$/);

    const tid = generateUniqueTid();
    expect(tid).toHaveLength(20);

    const card = generateUniqueCardNumber();
    expect(card).toMatch(/^STU-\d{4}-\d{5}$/);

    const email = generateUniqueEmail('student');
    expect(email).toMatch(/^student\.\d+\.[a-f0-9]+@test\.smartlib\.local$/);

    const book = createTestBookPayload();
    expect(validateIsbn13(book.isbn13)).toBe(true);
  });
});

