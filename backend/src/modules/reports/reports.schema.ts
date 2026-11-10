import { z } from 'zod';
import {
  CirculationStatus,
  MemberType,
  MemberStatus,
  FineStatus,
  FineReason,
  ItemStatus,
  DeviceStatus,
  MigrationStatus,
  AuditAction,
} from '@prisma/client';

export const reportTypeEnum = z.enum([
  'DASHBOARD',
  'CIRCULATION',
  'OVERDUE',
  'INVENTORY',
  'MEMBERS',
  'FINES',
  'RFID',
  'SECURITY_GATES',
  'GATE_EVENTS',
  'OPERATORS',
  'MIGRATIONS',
]);

export const exportFormatEnum = z.enum(['pdf', 'csv', 'json']).default('pdf');

const dateFieldSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true;
      const d = new Date(val);
      return !isNaN(d.getTime());
    },
    { message: 'Invalid date format (expected ISO 8601 or YYYY-MM-DD)' }
  );

export const reportFilterQuerySchema = z
  .object({
    startDate: dateFieldSchema,
    endDate: dateFieldSchema,
    academicYear: z
      .string()
      .regex(/^\d{4}(-\d{2,4})?$/, 'Academic year must be YYYY or YYYY-YYYY (e.g. 2025-2026)')
      .optional()
      .or(z.literal('')),
    department: z.string().max(100).optional(),
    memberCategory: z.nativeEnum(MemberType).optional().or(z.literal('')).transform((v) => (v === '' ? undefined : v)),
    memberStatus: z.nativeEnum(MemberStatus).optional().or(z.literal('')).transform((v) => (v === '' ? undefined : v)),
    bookCategory: z.string().max(100).optional(),
    rfidDevice: z.string().max(100).optional(),
    gateId: z.string().max(100).optional(),
    operator: z.string().max(100).optional(),
    transactionStatus: z
      .string()
      .max(50)
      .optional()
      .transform((v) => (v === '' || v === 'ALL' ? undefined : v)),
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => Math.max(1, parseInt(val, 10) || 1))
      .pipe(z.number()),
    limit: z
      .string()
      .optional()
      .default('25')
      .transform((val) => Math.min(200, Math.max(1, parseInt(val, 10) || 25)))
      .pipe(z.number()),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate && data.startDate.trim() !== '' && data.endDate.trim() !== '') {
        const s = new Date(data.startDate);
        const e = new Date(data.endDate);
        return s.getTime() <= e.getTime();
      }
      return true;
    },
    {
      message: 'startDate cannot be after endDate',
      path: ['startDate'],
    }
  );

export const exportReportQuerySchema = z
  .object({
    type: reportTypeEnum.optional().default('CIRCULATION'),
    reportType: reportTypeEnum.optional(),
    format: exportFormatEnum.optional().default('pdf'),
    startDate: dateFieldSchema,
    endDate: dateFieldSchema,
    academicYear: z
      .string()
      .regex(/^\d{4}(-\d{2,4})?$/, 'Academic year must be YYYY or YYYY-YYYY')
      .optional()
      .or(z.literal('')),
    department: z.string().max(100).optional(),
    memberCategory: z.nativeEnum(MemberType).optional().or(z.literal('')).transform((v) => (v === '' ? undefined : v)),
    bookCategory: z.string().max(100).optional(),
    rfidDevice: z.string().max(100).optional(),
    gateId: z.string().max(100).optional(),
    operator: z.string().max(100).optional(),
    transactionStatus: z
      .string()
      .max(50)
      .optional()
      .transform((v) => (v === '' || v === 'ALL' ? undefined : v)),
    limit: z
      .string()
      .optional()
      .default('100')
      .transform((val) => Math.min(500, Math.max(1, parseInt(val, 10) || 100)))
      .pipe(z.number()),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate && data.startDate.trim() !== '' && data.endDate.trim() !== '') {
        const s = new Date(data.startDate);
        const e = new Date(data.endDate);
        return s.getTime() <= e.getTime();
      }
      return true;
    },
    {
      message: 'startDate cannot be after endDate',
      path: ['startDate'],
    }
  );

export type ReportFilterQuery = z.infer<typeof reportFilterQuerySchema>;
export type ExportReportQuery = z.infer<typeof exportReportQuerySchema>;
export type ReportType = z.infer<typeof reportTypeEnum>;
export type ExportFormat = z.infer<typeof exportFormatEnum>;

export {
  CirculationStatus,
  MemberType,
  MemberStatus,
  FineStatus,
  FineReason,
  ItemStatus,
  DeviceStatus,
  MigrationStatus,
  AuditAction,
};
