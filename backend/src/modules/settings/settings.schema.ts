import { z } from 'zod';
import { ConfigDataType } from '@prisma/client';

export type SettingCategory =
  | 'CIRCULATION'
  | 'RFID'
  | 'SECURITY_GATE'
  | 'NOTIFICATIONS'
  | 'INSTITUTIONAL';

export interface SettingMetadata {
  key: string;
  fieldPath: string;
  category: SettingCategory;
  dataType: ConfigDataType;
  defaultValue: string;
  description: string;
  isSensitive?: boolean;
}

/**
 * Canonical Registry of All Institutional Policy & System Configuration Settings
 * Preserves exact existing defaults so Phase 1–4D behavior remains unchanged unless configured.
 */
export const SETTINGS_REGISTRY: SettingMetadata[] = [
  // ─── A. Circulation Policies ──────────────────────────────────────────────────
  {
    key: 'STUDENT_LOAN_DURATION_DAYS',
    fieldPath: 'circulation.studentLoanDurationDays',
    category: 'CIRCULATION',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '14',
    description: 'Standard loan period (in days) for student patrons',
  },
  {
    key: 'STAFF_LOAN_DURATION_DAYS',
    fieldPath: 'circulation.staffLoanDurationDays',
    category: 'CIRCULATION',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '14',
    description: 'Standard loan period (in days) for administrative and technical staff',
  },
  {
    key: 'FACULTY_LOAN_DURATION_DAYS',
    fieldPath: 'circulation.facultyLoanDurationDays',
    category: 'CIRCULATION',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '30',
    description: 'Extended loan period (in days) for faculty members',
  },
  {
    key: 'MAX_RENEWALS',
    fieldPath: 'circulation.maxRenewals',
    category: 'CIRCULATION',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '2',
    description: 'Maximum number of renewals permitted per active loan',
  },
  {
    key: 'RENEWAL_EXTENSION_DAYS',
    fieldPath: 'circulation.renewalExtensionDays',
    category: 'CIRCULATION',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '14',
    description: 'Number of days added to due date upon standard renewal',
  },
  {
    key: 'FACULTY_RENEWAL_EXTENSION_DAYS',
    fieldPath: 'circulation.facultyRenewalExtensionDays',
    category: 'CIRCULATION',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '30',
    description: 'Number of days added to due date upon faculty renewal',
  },
  {
    key: 'MAX_ACTIVE_LOANS_STUDENT',
    fieldPath: 'circulation.maxActiveLoansStudent',
    category: 'CIRCULATION',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '4',
    description: 'Maximum concurrent active loans permitted for student members',
  },
  {
    key: 'MAX_ACTIVE_LOANS_STAFF',
    fieldPath: 'circulation.maxActiveLoansStaff',
    category: 'CIRCULATION',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '6',
    description: 'Maximum concurrent active loans permitted for staff members',
  },
  {
    key: 'MAX_ACTIVE_LOANS_FACULTY',
    fieldPath: 'circulation.maxActiveLoansFaculty',
    category: 'CIRCULATION',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '10',
    description: 'Maximum concurrent active loans permitted for faculty members',
  },
  {
    key: 'MAX_ACTIVE_LOANS_RESEARCH_SCHOLAR',
    fieldPath: 'circulation.maxActiveLoansResearchScholar',
    category: 'CIRCULATION',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '8',
    description: 'Maximum concurrent active loans permitted for research scholars',
  },
  {
    key: 'MAX_ACTIVE_LOANS_GUEST',
    fieldPath: 'circulation.maxActiveLoansGuest',
    category: 'CIRCULATION',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '2',
    description: 'Maximum concurrent active loans permitted for guest patrons',
  },
  {
    key: 'DAILY_FINE_RATE',
    fieldPath: 'circulation.finePerOverdueDay',
    category: 'CIRCULATION',
    dataType: ConfigDataType.DECIMAL,
    defaultValue: '5.00',
    description: 'Monetary fine assessed per overdue calendar day (in institutional currency)',
    isSensitive: true,
  },
  {
    key: 'FINE_BORROWING_THRESHOLD',
    fieldPath: 'circulation.fineThresholdForBorrowingRestriction',
    category: 'CIRCULATION',
    dataType: ConfigDataType.DECIMAL,
    defaultValue: '25.00',
    description: 'Maximum unpaid fine balance permitted before checkout and renewal privileges are blocked',
    isSensitive: true,
  },
  {
    key: 'ENFORCE_REFERENCE_ONLY_RESTRICTION',
    fieldPath: 'circulation.enforceReferenceOnlyRestriction',
    category: 'CIRCULATION',
    dataType: ConfigDataType.BOOLEAN,
    defaultValue: 'true',
    description: 'Reject checkout and renewal operations on items marked Reference-Only',
    isSensitive: true,
  },

  // ─── B. RFID Configuration ────────────────────────────────────────────────────
  {
    key: 'RFID_MOCK_MODE',
    fieldPath: 'rfid.mockMode',
    category: 'RFID',
    dataType: ConfigDataType.BOOLEAN,
    defaultValue: 'true',
    description: 'Enable software RFID emulator mode when physical UHF/HF readers are disconnected',
    isSensitive: true,
  },
  {
    key: 'RFID_EVENT_RETRY_ATTEMPTS',
    fieldPath: 'rfid.eventRetryAttempts',
    category: 'RFID',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '3',
    description: 'Maximum retry attempts for failed RFID middleware event synchronization',
  },
  {
    key: 'RFID_EVENT_RETRY_BACKOFF_MS',
    fieldPath: 'rfid.eventRetryBackoffMs',
    category: 'RFID',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '2000',
    description: 'Base retry backoff interval (in milliseconds) for RFID telemetry delivery',
  },
  {
    key: 'RFID_DUPLICATE_DETECTION_WINDOW_SECONDS',
    fieldPath: 'rfid.duplicateEventWindowSeconds',
    category: 'RFID',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '5',
    description: 'Deduplication window (in seconds) to ignore repeated reads of the same EPC tag',
  },
  {
    key: 'RFID_DEVICE_HEALTH_CHECK_INTERVAL_SECONDS',
    fieldPath: 'rfid.deviceHealthCheckIntervalSeconds',
    category: 'RFID',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '30',
    description: 'Interval (in seconds) between reader heartbeat health checks',
  },
  {
    key: 'RFID_OFFLINE_BUFFER_ENABLED',
    fieldPath: 'rfid.offlineBufferEnabled',
    category: 'RFID',
    dataType: ConfigDataType.BOOLEAN,
    defaultValue: 'true',
    description: 'Persist RFID scan events in local SQLite buffer during backend connectivity outages',
  },
  {
    key: 'RFID_OFFLINE_BUFFER_MAX_RECORDS',
    fieldPath: 'rfid.offlineBufferMaxRecords',
    category: 'RFID',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '10000',
    description: 'Maximum number of events retained in the local offline buffer before rotation',
  },

  // ─── C. Security Gate Configuration ───────────────────────────────────────────
  {
    key: 'GATE_EVENT_LOGGING_ENABLED',
    fieldPath: 'securityGates.gateEventLoggingEnabled',
    category: 'SECURITY_GATE',
    dataType: ConfigDataType.BOOLEAN,
    defaultValue: 'true',
    description: 'Log all authorized and unauthorized security gate passages to database',
  },
  {
    key: 'GATE_ALERT_THRESHOLD_PER_HOUR',
    fieldPath: 'securityGates.alertThresholdPerHour',
    category: 'SECURITY_GATE',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '5',
    description: 'Number of unresolved gate alarms per hour that triggers an escalation alert',
  },
  {
    key: 'GATE_EAS_BEHAVIOR',
    fieldPath: 'securityGates.easBehavior',
    category: 'SECURITY_GATE',
    dataType: ConfigDataType.STRING,
    defaultValue: 'STRICT_ALARM',
    description: 'Security gate action when an armed EAS tag crosses the pedestal (STRICT_ALARM, SILENT_LOG, DISABLED)',
    isSensitive: true,
  },
  {
    key: 'GATE_EVENT_RETENTION_DAYS',
    fieldPath: 'securityGates.securityEventRetentionDays',
    category: 'SECURITY_GATE',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '365',
    description: 'Number of days security gate telemetry and CCTV references are retained',
  },

  // ─── D. Notification Settings ─────────────────────────────────────────────────
  {
    key: 'NOTIFICATIONS_EMAIL_ENABLED',
    fieldPath: 'notifications.emailEnabled',
    category: 'NOTIFICATIONS',
    dataType: ConfigDataType.BOOLEAN,
    defaultValue: 'true',
    description: 'Enable institutional email notifications for circulation and fine events',
  },
  {
    key: 'NOTIFICATIONS_SMS_ENABLED',
    fieldPath: 'notifications.smsEnabled',
    category: 'NOTIFICATIONS',
    dataType: ConfigDataType.BOOLEAN,
    defaultValue: 'false',
    description: 'Enable SMS text message dispatch for critical overdue and gate alerts',
  },
  {
    key: 'NOTIFICATIONS_DUE_DATE_REMINDER_ENABLED',
    fieldPath: 'notifications.dueDateReminderEnabled',
    category: 'NOTIFICATIONS',
    dataType: ConfigDataType.BOOLEAN,
    defaultValue: 'true',
    description: 'Send automated due-date reminder notices prior to loan expiration',
  },
  {
    key: 'NOTIFICATIONS_DUE_DATE_REMINDER_DAYS_BEFORE',
    fieldPath: 'notifications.dueDateReminderDaysBefore',
    category: 'NOTIFICATIONS',
    dataType: ConfigDataType.INTEGER,
    defaultValue: '2',
    description: 'Number of days before due date to send courtesy reminder notifications',
  },
  {
    key: 'NOTIFICATIONS_OVERDUE_ALERT_ENABLED',
    fieldPath: 'notifications.overdueAlertEnabled',
    category: 'NOTIFICATIONS',
    dataType: ConfigDataType.BOOLEAN,
    defaultValue: 'true',
    description: 'Send automated overdue penalty notifications to delinquent borrowers',
  },
  {
    key: 'NOTIFICATIONS_SECURITY_GATE_ALERT_ENABLED',
    fieldPath: 'notifications.securityGateAlertEnabled',
    category: 'NOTIFICATIONS',
    dataType: ConfigDataType.BOOLEAN,
    defaultValue: 'true',
    description: 'Dispatch immediate alerts to duty librarians when an EAS gate alarm triggers',
  },

  // ─── E. Institutional Settings ────────────────────────────────────────────────
  {
    key: 'INSTITUTION_NAME',
    fieldPath: 'institutional.institutionName',
    category: 'INSTITUTIONAL',
    dataType: ConfigDataType.STRING,
    defaultValue: 'National Institute of Technology',
    description: 'Official legal name of the academic institution',
  },
  {
    key: 'LIBRARY_NAME',
    fieldPath: 'institutional.libraryName',
    category: 'INSTITUTIONAL',
    dataType: ConfigDataType.STRING,
    defaultValue: 'Central RFID Knowledge Resource Centre',
    description: 'Official name of the central or departmental library',
  },
  {
    key: 'ACADEMIC_YEAR',
    fieldPath: 'institutional.academicYear',
    category: 'INSTITUTIONAL',
    dataType: ConfigDataType.STRING,
    defaultValue: '2025-2026',
    description: 'Current active academic calendar cycle (YYYY-YYYY)',
  },
  {
    key: 'TIME_ZONE',
    fieldPath: 'institutional.timeZone',
    category: 'INSTITUTIONAL',
    dataType: ConfigDataType.STRING,
    defaultValue: 'Asia/Kolkata',
    description: 'IANA standard time zone used for due dates and compliance reports',
  },
  {
    key: 'CURRENCY',
    fieldPath: 'institutional.currency',
    category: 'INSTITUTIONAL',
    dataType: ConfigDataType.STRING,
    defaultValue: 'INR',
    description: 'ISO 4217 currency code for fine assessments and book valuations',
  },
  {
    key: 'CONTACT_EMAIL',
    fieldPath: 'institutional.contactEmail',
    category: 'INSTITUTIONAL',
    dataType: ConfigDataType.STRING,
    defaultValue: 'library-admin@smartlib.ac.in',
    description: 'Official institutional contact email for patron inquiries and notices',
  },
  {
    key: 'CONTACT_PHONE',
    fieldPath: 'institutional.contactPhone',
    category: 'INSTITUTIONAL',
    dataType: ConfigDataType.STRING,
    defaultValue: '+91-11-2659-7135',
    description: 'Official library circulation desk telephone number',
  },
];

// ─── Zod Validation Schemas for Structured & Key-Based Updates ─────────────────

export const circulationPolicySchema = z
  .object({
    studentLoanDurationDays: z.number().int().min(1).max(365).optional(),
    staffLoanDurationDays: z.number().int().min(1).max(365).optional(),
    facultyLoanDurationDays: z.number().int().min(1).max(365).optional(),
    maxRenewals: z.number().int().min(0).max(20).optional(),
    renewalExtensionDays: z.number().int().min(1).max(180).optional(),
    facultyRenewalExtensionDays: z.number().int().min(1).max(180).optional(),
    maxActiveLoansStudent: z.number().int().min(1).max(50).optional(),
    maxActiveLoansStaff: z.number().int().min(1).max(50).optional(),
    maxActiveLoansFaculty: z.number().int().min(1).max(100).optional(),
    maxActiveLoansResearchScholar: z.number().int().min(1).max(50).optional(),
    maxActiveLoansGuest: z.number().int().min(1).max(20).optional(),
    finePerOverdueDay: z.number().min(0).max(1000).optional(),
    fineThresholdForBorrowingRestriction: z.number().min(0).max(50000).optional(),
    enforceReferenceOnlyRestriction: z.boolean().optional(),
  })
  .strict();

export const rfidConfigSchema = z
  .object({
    mockMode: z.boolean().optional(),
    eventRetryAttempts: z.number().int().min(0).max(20).optional(),
    eventRetryBackoffMs: z.number().int().min(100).max(60000).optional(),
    duplicateEventWindowSeconds: z.number().int().min(1).max(300).optional(),
    deviceHealthCheckIntervalSeconds: z.number().int().min(5).max(3600).optional(),
    offlineBufferEnabled: z.boolean().optional(),
    offlineBufferMaxRecords: z.number().int().min(100).max(100000).optional(),
  })
  .strict();

export const securityGatesConfigSchema = z
  .object({
    gateEventLoggingEnabled: z.boolean().optional(),
    alertThresholdPerHour: z.number().int().min(1).max(500).optional(),
    easBehavior: z.enum(['STRICT_ALARM', 'SILENT_LOG', 'DISABLED']).optional(),
    securityEventRetentionDays: z.number().int().min(30).max(3650).optional(),
  })
  .strict();

export const notificationsConfigSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    dueDateReminderEnabled: z.boolean().optional(),
    dueDateReminderDaysBefore: z.number().int().min(1).max(30).optional(),
    overdueAlertEnabled: z.number().or(z.boolean()).transform((v) => Boolean(v)).optional(),
    securityGateAlertEnabled: z.boolean().optional(),
  })
  .strict();

export const institutionalConfigSchema = z
  .object({
    institutionName: z.string().trim().min(2).max(200).optional(),
    libraryName: z.string().trim().min(2).max(200).optional(),
    academicYear: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{4}$/, 'Academic year must be in YYYY-YYYY format (e.g. 2025-2026)')
      .optional(),
    timeZone: z.string().trim().min(2).max(100).optional(),
    currency: z.string().trim().min(3).max(10).optional(),
    contactEmail: z.string().trim().email('Invalid institutional contact email').optional(),
    contactPhone: z.string().trim().min(5).max(35).optional(),
  })
  .strict();

export const updateSettingsBodySchema = z
  .object({
    circulation: circulationPolicySchema.optional(),
    rfid: rfidConfigSchema.optional(),
    securityGates: securityGatesConfigSchema.optional(),
    notifications: notificationsConfigSchema.optional(),
    institutional: institutionalConfigSchema.optional(),
    settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    reason: z.string().max(500).optional(),
  })
  .strict()
  .refine(
    (data) =>
      Boolean(
        data.circulation ||
          data.rfid ||
          data.securityGates ||
          data.notifications ||
          data.institutional ||
          (data.settings && Object.keys(data.settings).length > 0)
      ),
    {
      message: 'At least one configuration category or setting key must be provided for update',
    }
  );

export const settingsHistoryQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((v) => Math.max(1, parseInt(v, 10) || 1))
    .pipe(z.number()),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((v) => Math.min(100, Math.max(1, parseInt(v, 10) || 20)))
    .pipe(z.number()),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsBodySchema>;
export type SettingsHistoryQuery = z.infer<typeof settingsHistoryQuerySchema>;

