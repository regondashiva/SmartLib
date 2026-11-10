import { z } from 'zod';
import { MigrationStatus } from '@prisma/client';

export const stageRecordInputSchema = z.record(z.unknown());

export const createBatchSchema = z.object({
  batchName: z.string().min(1, 'Batch name is required').max(100),
  sourceFileName: z.string().min(1, 'Source filename is required').max(255),
  records: z.array(stageRecordInputSchema).min(1, 'At least one record is required in the batch'),
  mapping: z.record(z.string()).optional(),
});

export const batchIdParamSchema = z.object({
  id: z.string().uuid('Invalid batch UUID'),
});

export const listBatchesQuerySchema = z.object({
  status: z.nativeEnum(MigrationStatus).optional(),
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

export const previewQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .default('50')
    .transform((val) => Math.min(200, Math.max(1, parseInt(val, 10))))
    .pipe(z.number()),
  status: z.enum(['ALL', 'VALID', 'INVALID', 'COMMITTED']).optional().default('ALL'),
});

export const exportErrorsQuerySchema = z.object({
  format: z.enum(['csv', 'json']).optional().default('csv'),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type ListBatchesQuery = z.infer<typeof listBatchesQuerySchema>;
export type PreviewQuery = z.infer<typeof previewQuerySchema>;
