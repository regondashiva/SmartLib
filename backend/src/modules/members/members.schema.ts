import { z } from 'zod';
import { MemberType, MemberStatus } from '@prisma/client';

export const getMembersQuerySchema = z.object({
  search: z.string().optional(),
  memberType: z.nativeEnum(MemberType).optional(),
  status: z.nativeEnum(MemberStatus).optional(),
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

export const memberIdParamSchema = z.object({
  id: z.string().uuid('Invalid Member UUID format'),
});

export const smartCardUidParamSchema = z.object({
  uid: z.string().min(1, 'Smart card UID is required'),
});

export type GetMembersQuery = z.infer<typeof getMembersQuerySchema>;

