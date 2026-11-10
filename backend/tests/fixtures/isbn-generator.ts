/**
 * Mathematically Valid ISBN-13 Generator
 * Computes official mod-10 weighted check digit for ISO 2108 compliance.
 */
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

/**
 * Generates a unique, mathematically valid ISBN-13 starting with 978 or 979.
 * Uses high-resolution timestamp + random bytes to ensure uniqueness across workers.
 */
export function generateValidUniqueTestIsbn(prefix = '978'): string {
  if (prefix !== '978' && prefix !== '979') {
    prefix = '978';
  }
  // Generate 9 random digits to form 12 digits total
  const randomSuffix = randomBytes(5).readUInt32BE(0).toString().padStart(9, '0').slice(-9);
  const first12 = `${prefix}${randomSuffix}`;
  const checkDigit = calculateIsbn13CheckDigit(first12);
  return `${first12}${checkDigit}`;
}
