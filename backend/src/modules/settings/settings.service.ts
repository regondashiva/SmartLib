import { prisma } from '../../config/prisma.js';
import { ValidationError } from '../../utils/errors.js';
import {
  SETTINGS_REGISTRY,
  SettingMetadata,
  UpdateSettingsInput,
  SettingsHistoryQuery,
  updateSettingsBodySchema,
} from './settings.schema.js';
import { AuditAction, ConfigDataType, MemberType, Prisma } from '@prisma/client';

export interface StructuredSettings {
  circulation: {
    studentLoanDurationDays: number;
    staffLoanDurationDays: number;
    facultyLoanDurationDays: number;
    maxRenewals: number;
    renewalExtensionDays: number;
    facultyRenewalExtensionDays: number;
    maxActiveLoansStudent: number;
    maxActiveLoansStaff: number;
    maxActiveLoansFaculty: number;
    maxActiveLoansResearchScholar: number;
    maxActiveLoansGuest: number;
    finePerOverdueDay: number;
    fineThresholdForBorrowingRestriction: number;
    enforceReferenceOnlyRestriction: boolean;
  };
  rfid: {
    mockMode: boolean;
    eventRetryAttempts: number;
    eventRetryBackoffMs: number;
    duplicateEventWindowSeconds: number;
    deviceHealthCheckIntervalSeconds: number;
    offlineBufferEnabled: boolean;
    offlineBufferMaxRecords: number;
  };
  securityGates: {
    gateEventLoggingEnabled: boolean;
    alertThresholdPerHour: number;
    easBehavior: 'STRICT_ALARM' | 'SILENT_LOG' | 'DISABLED';
    securityEventRetentionDays: number;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    dueDateReminderEnabled: boolean;
    dueDateReminderDaysBefore: number;
    overdueAlertEnabled: boolean;
    securityGateAlertEnabled: boolean;
  };
  institutional: {
    institutionName: string;
    libraryName: string;
    academicYear: string;
    timeZone: string;
    currency: string;
    contactEmail: string;
    contactPhone: string;
  };
}

// Lookup maps for O(1) resolution
const BY_KEY = new Map<string, SettingMetadata>();
const BY_PATH = new Map<string, SettingMetadata>();
for (const meta of SETTINGS_REGISTRY) {
  BY_KEY.set(meta.key, meta);
  BY_PATH.set(meta.fieldPath, meta);
}

// Forbidden secret patterns that must never be accepted or exposed
const FORBIDDEN_KEY_PATTERN = /(SECRET|PASSWORD|PRIVATE_KEY|TOKEN|DATABASE_URL|DIRECT_URL|CREDENTIAL)/i;

function parseTypedValue(raw: string, dataType: ConfigDataType): string | number | boolean {
  switch (dataType) {
    case ConfigDataType.INTEGER: {
      const n = parseInt(raw, 10);
      return isNaN(n) ? 0 : n;
    }
    case ConfigDataType.DECIMAL: {
      const d = parseFloat(raw);
      return isNaN(d) ? 0 : Math.round(d * 100) / 100;
    }
    case ConfigDataType.BOOLEAN:
      return raw === 'true' || raw === '1';
    default:
      return raw;
  }
}

function serializeValue(val: unknown, dataType: ConfigDataType): string {
  if (dataType === ConfigDataType.DECIMAL) {
    const num = Number(val);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  }
  if (dataType === ConfigDataType.INTEGER) {
    const num = parseInt(String(val), 10);
    return isNaN(num) ? '0' : String(num);
  }
  if (dataType === ConfigDataType.BOOLEAN) {
    return val === true || val === 'true' || val === 1 ? 'true' : 'false';
  }
  return String(val ?? '').trim();
}

export class SettingsService {
  private defaultsInitialized = false;

  /**
   * Ensures all canonical default settings exist in SystemConfiguration table
   * on first-time installation or missing keys without overwriting existing custom values.
   */
  async ensureDefaultsExist(): Promise<void> {
    if (this.defaultsInitialized) return;

    const existing = await prisma.systemConfiguration.findMany({
      select: { configKey: true },
    });
    const existingKeys = new Set(existing.map((e) => e.configKey));

    const missing = SETTINGS_REGISTRY.filter((m) => !existingKeys.has(m.key));
    if (missing.length > 0) {
      await prisma.systemConfiguration.createMany({
        data: missing.map((m) => ({
          configKey: m.key,
          configValue: m.defaultValue,
          dataType: m.dataType,
          category: m.category,
          description: m.description,
        })),
        skipDuplicates: true,
      });
    }

    this.defaultsInitialized = true;
  }

  /**
   * Retrieves all settings structured by domain category + metadata registry
   * Never exposes secrets, credentials, or tokens.
   */
  async getSettings() {
    await this.ensureDefaultsExist();

    const rows = await prisma.systemConfiguration.findMany({
      include: {
        updatedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { configKey: 'asc' },
    });

    const rowByKey = new Map(rows.map((r) => [r.configKey, r]));

    // Build structured settings object starting from defaults
    const structured: Record<string, Record<string, any>> = {
      circulation: {},
      rfid: {},
      securityGates: {},
      notifications: {},
      institutional: {},
    };

    const items: Array<{
      key: string;
      fieldPath: string;
      category: string;
      dataType: string;
      value: string | number | boolean;
      defaultValue: string | number | boolean;
      description: string;
      isSensitive: boolean;
      updatedAt: string | null;
      updatedBy: string | null;
    }> = [];

    let latestUpdateAt: Date | null = null;

    for (const meta of SETTINGS_REGISTRY) {
      if (FORBIDDEN_KEY_PATTERN.test(meta.key)) continue;

      const dbRow = rowByKey.get(meta.key);
      const rawVal = dbRow ? dbRow.configValue : meta.defaultValue;
      const typedVal = parseTypedValue(rawVal, meta.dataType);
      const typedDefault = parseTypedValue(meta.defaultValue, meta.dataType);

      const [section, prop] = meta.fieldPath.split('.');
      if (section && prop && structured[section]) {
        structured[section][prop] = typedVal;
      }

      if (dbRow?.updatedAt && (!latestUpdateAt || dbRow.updatedAt > latestUpdateAt)) {
        latestUpdateAt = dbRow.updatedAt;
      }

      items.push({
        key: meta.key,
        fieldPath: meta.fieldPath,
        category: meta.category,
        dataType: meta.dataType,
        value: typedVal,
        defaultValue: typedDefault,
        description: meta.description,
        isSensitive: Boolean(meta.isSensitive),
        updatedAt: dbRow?.updatedAt ? dbRow.updatedAt.toISOString() : null,
        updatedBy: dbRow?.updatedByUser
          ? `${dbRow.updatedByUser.firstName} ${dbRow.updatedByUser.lastName}`
          : null,
      });
    }

    return {
      ...(structured as unknown as StructuredSettings),
      items,
      lastUpdatedAt: latestUpdateAt ? latestUpdateAt.toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Fast helper for CirculationService & ReportsService to read live policy rules
   */
  async getCirculationPolicies(tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const rows = await client.systemConfiguration.findMany({
      where: { category: 'CIRCULATION' },
    });
    const map = new Map(rows.map((r) => [r.configKey, r.configValue]));

    const getInt = (key: string, fallback: number): number => {
      const raw = map.get(key);
      if (raw === undefined) return fallback;
      const parsed = parseInt(raw, 10);
      return isNaN(parsed) ? fallback : parsed;
    };

    const getDec = (key: string, fallback: string): Prisma.Decimal => {
      const raw = map.get(key);
      if (raw === undefined) return new Prisma.Decimal(fallback);
      try {
        return new Prisma.Decimal(raw);
      } catch {
        return new Prisma.Decimal(fallback);
      }
    };

    const getBool = (key: string, fallback: boolean): boolean => {
      const raw = map.get(key);
      if (raw === undefined) return fallback;
      return raw === 'true' || raw === '1';
    };

    const studentLoanDurationDays = getInt('STUDENT_LOAN_DURATION_DAYS', 14);
    const staffLoanDurationDays = getInt('STAFF_LOAN_DURATION_DAYS', 14);
    const facultyLoanDurationDays = getInt('FACULTY_LOAN_DURATION_DAYS', 30);
    const maxRenewals = getInt('MAX_RENEWALS', 2);
    const renewalExtensionDays = getInt('RENEWAL_EXTENSION_DAYS', 14);
    const facultyRenewalExtensionDays = getInt('FACULTY_RENEWAL_EXTENSION_DAYS', 30);
    const maxActiveLoansStudent = getInt('MAX_ACTIVE_LOANS_STUDENT', 4);
    const maxActiveLoansStaff = getInt('MAX_ACTIVE_LOANS_STAFF', 6);
    const maxActiveLoansFaculty = getInt('MAX_ACTIVE_LOANS_FACULTY', 10);
    const maxActiveLoansResearchScholar = getInt('MAX_ACTIVE_LOANS_RESEARCH_SCHOLAR', 8);
    const maxActiveLoansGuest = getInt('MAX_ACTIVE_LOANS_GUEST', 2);
    const finePerOverdueDay = getDec('DAILY_FINE_RATE', '5.00');
    const fineThreshold = getDec('FINE_BORROWING_THRESHOLD', '25.00');
    const enforceReferenceOnly = getBool('ENFORCE_REFERENCE_ONLY_RESTRICTION', true);

    const resolveLoanDuration = (memberType: MemberType): number => {
      switch (memberType) {
        case 'FACULTY':
          return facultyLoanDurationDays;
        case 'STAFF':
          return staffLoanDurationDays;
        case 'STUDENT':
        default:
          return studentLoanDurationDays;
      }
    };

    const resolveRenewalExtension = (memberType: MemberType): number => {
      if (memberType === 'FACULTY') {
        // If standard renewal extension was explicitly customized away from 14 while faculty renewal extension stayed at 30,
        // or if facultyType is used, respect facultyRenewalExtensionDays unless renewalExtensionDays was customized
        return facultyRenewalExtensionDays;
      }
      return renewalExtensionDays;
    };

    const resolveCategoryMaxLoans = (memberType: MemberType): number => {
      switch (memberType) {
        case 'FACULTY':
          return maxActiveLoansFaculty;
        case 'STAFF':
          return maxActiveLoansStaff;
        case 'RESEARCH_SCHOLAR':
          return maxActiveLoansResearchScholar;
        case 'GUEST':
          return maxActiveLoansGuest;
        case 'STUDENT':
        default:
          return maxActiveLoansStudent;
      }
    };

    return {
      studentLoanDurationDays,
      staffLoanDurationDays,
      facultyLoanDurationDays,
      maxRenewals,
      renewalExtensionDays,
      facultyRenewalExtensionDays,
      maxActiveLoansStudent,
      maxActiveLoansStaff,
      maxActiveLoansFaculty,
      maxActiveLoansResearchScholar,
      maxActiveLoansGuest,
      finePerOverdueDay,
      fineThreshold,
      enforceReferenceOnly,
      resolveLoanDuration,
      resolveRenewalExtension,
      resolveCategoryMaxLoans,
    };
  }

  /**
   * Updates settings transactionally, validates every field against Zod & registry,
   * prevents secret injection, and records before/after diffs in AuditLog.
   */
  async updateSettings(
    input: UpdateSettingsInput,
    actorUserId: string,
    actorEmail?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // 1. Validate top-level input with Zod
    const parsedInput = updateSettingsBodySchema.parse(input);

    await this.ensureDefaultsExist();

    // 2. Collect requested updates mapped to canonical configKey
    const updatesToApply = new Map<string, { meta: SettingMetadata; newValueStr: string; newTypedVal: any }>();

    const nestedCategories: Array<keyof Pick<
      UpdateSettingsInput,
      'circulation' | 'rfid' | 'securityGates' | 'notifications' | 'institutional'
    >> = ['circulation', 'rfid', 'securityGates', 'notifications', 'institutional'];

    for (const catKey of nestedCategories) {
      const catObj = parsedInput[catKey];
      if (catObj && typeof catObj === 'object') {
        for (const [prop, val] of Object.entries(catObj)) {
          if (val === undefined) continue;
          const path = `${catKey}.${prop}`;
          const meta = BY_PATH.get(path);
          if (!meta) {
            throw new ValidationError(`Unsupported setting field: '${path}'`);
          }
          const serialized = serializeValue(val, meta.dataType);
          updatesToApply.set(meta.key, {
            meta,
            newValueStr: serialized,
            newTypedVal: parseTypedValue(serialized, meta.dataType),
          });
        }
      }
    }

    // Also support flat key-value `settings: { DAILY_FINE_RATE: 10 }` map if provided
    if (parsedInput.settings) {
      // Convert flat keys to structured object to run strict Zod domain validation
      const syntheticStructured: Record<string, Record<string, any>> = {};
      for (const [rawKey, rawVal] of Object.entries(parsedInput.settings)) {
        if (FORBIDDEN_KEY_PATTERN.test(rawKey)) {
          throw new ValidationError(`Security violation: Cannot configure secret or credential key '${rawKey}'`);
        }
        const meta = BY_KEY.get(rawKey) || BY_PATH.get(rawKey);
        if (!meta) {
          throw new ValidationError(`Unsupported or unrecognized setting key: '${rawKey}'`);
        }
        const [sec, prop] = meta.fieldPath.split('.');
        if (sec && prop) {
          if (!syntheticStructured[sec]) syntheticStructured[sec] = {};
          const coerced =
            meta.dataType === ConfigDataType.INTEGER || meta.dataType === ConfigDataType.DECIMAL
              ? Number(rawVal)
              : meta.dataType === ConfigDataType.BOOLEAN
              ? Boolean(rawVal === true || rawVal === 'true' || rawVal === 1)
              : String(rawVal);
          syntheticStructured[sec][prop] = coerced;
        }
      }

      // Validate coerced flat settings through the strict domain schemas
      const validatedFlat = updateSettingsBodySchema.parse(syntheticStructured);
      for (const catKey of nestedCategories) {
        const catObj = validatedFlat[catKey];
        if (catObj && typeof catObj === 'object') {
          for (const [prop, val] of Object.entries(catObj)) {
            if (val === undefined) continue;
            const meta = BY_PATH.get(`${catKey}.${prop}`)!;
            const serialized = serializeValue(val, meta.dataType);
            updatesToApply.set(meta.key, {
              meta,
              newValueStr: serialized,
              newTypedVal: parseTypedValue(serialized, meta.dataType),
            });
          }
        }
      }
    }

    if (updatesToApply.size === 0) {
      throw new ValidationError('No valid configuration settings provided for update');
    }

    // 3. Execute atomic transaction updating SystemConfiguration and recording AuditLog
    await prisma.$transaction(
      async (tx) => {
        const keysToFetch = Array.from(updatesToApply.keys());
        const currentRows = await tx.systemConfiguration.findMany({
          where: { configKey: { in: keysToFetch } },
        });
        const currentMap = new Map(currentRows.map((r) => [r.configKey, r.configValue]));

        const previousState: Record<string, any> = {};
        const newState: Record<string, any> = {};
        const changedFields: string[] = [];

        for (const [configKey, item] of updatesToApply.entries()) {
          const prevStr = currentMap.get(configKey) ?? item.meta.defaultValue;
          const prevTyped = parseTypedValue(prevStr, item.meta.dataType);

          previousState[configKey] = prevTyped;
          newState[configKey] = item.newTypedVal;

          if (prevStr !== item.newValueStr) {
            changedFields.push(configKey);
          }

          await tx.systemConfiguration.upsert({
            where: { configKey },
            update: {
              configValue: item.newValueStr,
              updatedByUserId: actorUserId,
            },
            create: {
              configKey,
              configValue: item.newValueStr,
              dataType: item.meta.dataType,
              category: item.meta.category,
              description: item.meta.description,
              updatedByUserId: actorUserId,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            actorUserId,
            actorEmail: actorEmail || null,
            action: AuditAction.SYSTEM_CONFIG_CHANGE,
            entityName: 'SystemConfiguration',
            entityId: changedFields.length === 1 ? changedFields[0]! : 'BATCH_POLICY_UPDATE',
            previousState: previousState as Prisma.InputJsonValue,
            newState: {
              ...newState,
              _meta: {
                changedFields,
                reason: parsedInput.reason || 'Administrative policy update',
              },
            } as Prisma.InputJsonValue,
            ipAddress: ipAddress || '127.0.0.1',
            userAgent: userAgent || null,
          },
        });
      },
      { timeout: 30000, maxWait: 15000 }
    );

    return this.getSettings();
  }

  /**
   * Retrieves chronological history of settings changes from AuditLog
   */
  async getSettingsHistory(query: SettingsHistoryQuery) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      OR: [
        { action: AuditAction.SYSTEM_CONFIG_CHANGE },
        { entityName: 'SystemConfiguration' },
      ],
    };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          actorUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const history = logs.map((log) => {
      const prevObj = (log.previousState as Record<string, any>) || {};
      const nextObj = { ...((log.newState as Record<string, any>) || {}) };
      const meta = nextObj._meta || {};
      delete nextObj._meta;

      const changes: Array<{
        key: string;
        previousValue: unknown;
        newValue: unknown;
      }> = [];

      for (const k of Object.keys(nextObj)) {
        if (FORBIDDEN_KEY_PATTERN.test(k)) continue;
        changes.push({
          key: k,
          previousValue: prevObj[k] ?? null,
          newValue: nextObj[k],
        });
      }

      return {
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        administrator: log.actorUser
          ? {
              id: log.actorUser.id,
              name: `${log.actorUser.firstName} ${log.actorUser.lastName}`,
              email: log.actorUser.email,
              role: log.actorUser.role.name,
            }
          : {
              id: log.actorUserId || 'system',
              name: log.actorEmail || 'System Administrator',
              email: log.actorEmail || 'admin@smartlib.ac.in',
              role: 'ADMIN',
            },
        reason: meta.reason || 'Institutional policy configuration update',
        changedFields: Array.isArray(meta.changedFields)
          ? meta.changedFields
          : changes.map((c) => c.key),
        changes,
        previousState: prevObj,
        newState: nextObj,
        ipAddress: log.ipAddress || '127.0.0.1',
      };
    });

    return {
      items: history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}

export const settingsService = new SettingsService();
