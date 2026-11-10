import { z } from 'zod';
import { AuditAction } from '@prisma/client';

export const getAuditLogsQuerySchema = z.object({
  action: z.nativeEnum(AuditAction).optional(),
  entityName: z.string().optional(),
  actorUserId: z.string().uuid().optional(),
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

export type GetAuditLogsQuery = z.infer<typeof getAuditLogsQuerySchema>;

