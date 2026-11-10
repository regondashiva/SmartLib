import { z } from 'zod';

export const getBooksQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(1, parseInt(val, 10)))
    .pipe(z.number()),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10))))
    .pipe(z.number()),
});

export const bookIdParamSchema = z.object({
  id: z.string().uuid('Invalid Book UUID format'),
});

export const bookCopyInputSchema = z.object({
  accessionNumber: z.string().min(1).max(50).optional(),
  barcode: z.string().max(50).optional(),
  shelfLocation: z.string().max(100).default('MAIN-STACKS'),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'WORN', 'DAMAGED']).default('GOOD'),
  status: z
    .enum(['AVAILABLE', 'REFERENCE_ONLY', 'DAMAGED', 'BINDING', 'RESERVED'])
    .default('AVAILABLE'),
  isReferenceOnly: z.boolean().default(false),
  price: z.number().positive().optional(),
});

export const createBookSchema = z.object({
  title: z.string().min(1, 'Book title is required').max(500),
  subtitle: z.string().max(500).optional(),
  isbn13: z
    .string()
    .regex(/^(97[89])?\d{9}[\dX]$/, 'Invalid ISBN-10 or ISBN-13 format')
    .optional()
    .or(z.literal('')),
  isbn10: z.string().max(15).optional().or(z.literal('')),
  edition: z.string().max(50).optional(),
  publisherName: z.string().max(255).optional(),
  publisherId: z.string().uuid().optional(),
  publicationYear: z
    .number()
    .int()
    .min(1000)
    .max(new Date().getFullYear() + 1)
    .optional(),
  categoryName: z.string().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  classification: z.string().max(100).optional(),
  callNumber: z.string().max(100).optional(),
  description: z.string().optional(),
  language: z.string().max(50).default('English'),
  pageCount: z.number().int().positive().optional(),
  coverImageUrl: z.string().url().max(500).optional().or(z.literal('')),
  authors: z.array(z.string().min(1)).min(1, 'At least one author is required'),
  // Option A: Quick copies generation
  copiesCount: z.number().int().min(1).max(50).default(1),
  shelfLocation: z.string().max(100).default('MAIN-STACKS'),
  isReferenceOnly: z.boolean().default(false),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'WORN', 'DAMAGED']).default('GOOD'),
  price: z.number().positive().optional(),
  // Option B: Detailed copies array
  copies: z.array(bookCopyInputSchema).optional(),
});

export const updateBookCopySchema = z.object({
  id: z.string().uuid().optional(),
  accessionNumber: z.string().min(1).max(50).optional(),
  barcode: z.string().max(50).optional(),
  shelfLocation: z.string().max(100).optional(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'WORN', 'DAMAGED']).optional(),
  status: z
    .enum(['AVAILABLE', 'REFERENCE_ONLY', 'DAMAGED', 'BINDING', 'RESERVED'])
    .optional(),
  isReferenceOnly: z.boolean().optional(),
  price: z.number().positive().optional(),
});

export const updateBookSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  subtitle: z.string().max(500).optional(),
  isbn13: z
    .string()
    .regex(/^(97[89])?\d{9}[\dX]$/, 'Invalid ISBN-10 or ISBN-13 format')
    .optional()
    .or(z.literal('')),
  isbn10: z.string().max(15).optional().or(z.literal('')),
  edition: z.string().max(50).optional(),
  publisherName: z.string().max(255).optional(),
  publisherId: z.string().uuid().optional(),
  publicationYear: z
    .number()
    .int()
    .min(1000)
    .max(new Date().getFullYear() + 1)
    .optional(),
  categoryName: z.string().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  classification: z.string().max(100).optional(),
  callNumber: z.string().max(100).optional(),
  description: z.string().optional(),
  language: z.string().max(50).optional(),
  pageCount: z.number().int().positive().optional(),
  coverImageUrl: z.string().url().max(500).optional().or(z.literal('')),
  authors: z.array(z.string().min(1)).optional(),
  copies: z.array(updateBookCopySchema).optional(),
});

export type GetBooksQuery = z.infer<typeof getBooksQuerySchema>;
export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type BookCopyInput = z.infer<typeof bookCopyInputSchema>;
