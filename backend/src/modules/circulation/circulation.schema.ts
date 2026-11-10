import { z } from 'zod';
import { CirculationStatus, FineStatus } from '@prisma/client';

export const getCirculationsQuerySchema = z.object({
  status: z.nativeEnum(CirculationStatus).optional(),
  memberId: z.string().uuid().optional(),
  bookItemId: z.string().uuid().optional(),
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

export const issueBookSchema = z.object({
  memberId: z.string().uuid('Invalid Member UUID'),
  bookItemId: z.string().uuid('Invalid BookItem UUID'),
  dueDays: z.number().min(1).max(180).optional(),
});

export const returnLoanSchema = z
  .object({
    circulationId: z.string().uuid().optional(),
    bookItemId: z.string().uuid().optional(),
    accessionNumber: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => Boolean(data.circulationId || data.bookItemId || data.accessionNumber),
    {
      message: 'Either circulationId, bookItemId, or accessionNumber must be provided',
    }
  );

export const renewLoanSchema = z
  .object({
    circulationId: z.string().uuid().optional(),
    bookItemId: z.string().uuid().optional(),
    accessionNumber: z.string().optional(),
  })
  .refine(
    (data) => Boolean(data.circulationId || data.bookItemId || data.accessionNumber),
    {
      message: 'Either circulationId, bookItemId, or accessionNumber must be provided',
    }
  );

export const getCirculationByIdSchema = z.object({
  id: z.string().uuid('Invalid circulation ID'),
});

export const payFineSchema = z.object({
  fineId: z.string().uuid('Invalid fine ID'),
  amount: z.number().positive('Payment amount must be positive'),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'ONLINE']).optional().default('CASH'),
});

export const waiveFineSchema = z.object({
  fineId: z.string().uuid('Invalid fine ID'),
  reason: z.string().min(5, 'Waiver reason must be at least 5 characters'),
});

export const getFinesQuerySchema = z.object({
  memberId: z.string().uuid().optional(),
  circulationId: z.string().uuid().optional(),
  status: z.nativeEnum(FineStatus).optional(),
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(1, parseInt(val, 10)))
    .pipe(z.number()),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10))))
    .pipe(z.number()),
});

export type GetCirculationsQuery = z.infer<typeof getCirculationsQuerySchema>;
export type IssueBookInput = z.infer<typeof issueBookSchema>;
export type ReturnLoanInput = z.infer<typeof returnLoanSchema>;
export type RenewLoanInput = z.infer<typeof renewLoanSchema>;
export type GetCirculationByIdInput = z.infer<typeof getCirculationByIdSchema>;
export type PayFineInput = z.infer<typeof payFineSchema>;
export type WaiveFineInput = z.infer<typeof waiveFineSchema>;
export type GetFinesQuery = z.infer<typeof getFinesQuerySchema>;

