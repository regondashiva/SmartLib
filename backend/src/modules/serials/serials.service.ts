import { prisma } from '../../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { AuditAction, ConfigDataType, Prisma } from '@prisma/client';
import crypto from 'crypto';

const SERIALS_KEY = 'serials.journals.v1';
const ISSUES_KEY = 'serials.issues.v1';

export type PublicationFrequency =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'ANNUAL';

export interface SerialRecord {
  id: string;
  issn: string;
  title: string;
  publisher: string;
  subject: string;
  frequency: PublicationFrequency;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  subscriptionStatus: 'ACTIVE' | 'RENEWAL_DUE' | 'EXPIRED' | 'CANCELLED';
  renewalCount: number;
  annualSubscriptionCost: number;
  shelfLocation: string;
  createdAt: string;
  updatedAt: string;
}

export interface SerialIssueRecord {
  id: string;
  serialId: string;
  serialTitle: string;
  issn: string;
  volumeNumber: string;
  issueNumber: string;
  expectedDate: string;
  receivedDate: string | null;
  status: 'EXPECTED' | 'RECEIVED' | 'MISSING' | 'LATE';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_SERIALS: SerialRecord[] = [
  {
    id: 'ser-default-01',
    issn: '0018-9162',
    title: 'IEEE Computer Magazine',
    publisher: 'IEEE Computer Society',
    subject: 'Computer Science & Engineering',
    frequency: 'MONTHLY',
    subscriptionStartDate: '2026-01-01',
    subscriptionEndDate: '2026-12-31',
    subscriptionStatus: 'ACTIVE',
    renewalCount: 1,
    annualSubscriptionCost: 18500,
    shelfLocation: 'PERIODICALS-RACK-A1',
    createdAt: '2026-01-02T09:00:00.000Z',
    updatedAt: '2026-01-02T09:00:00.000Z',
  },
  {
    id: 'ser-default-02',
    issn: '0001-0782',
    title: 'Communications of the ACM',
    publisher: 'Association for Computing Machinery',
    subject: 'Information Systems & Algorithms',
    frequency: 'MONTHLY',
    subscriptionStartDate: '2026-01-01',
    subscriptionEndDate: '2026-12-31',
    subscriptionStatus: 'ACTIVE',
    renewalCount: 2,
    annualSubscriptionCost: 16200,
    shelfLocation: 'PERIODICALS-RACK-A2',
    createdAt: '2026-01-02T09:00:00.000Z',
    updatedAt: '2026-01-02T09:00:00.000Z',
  },
];

const DEFAULT_ISSUES: SerialIssueRecord[] = [
  {
    id: 'iss-default-01',
    serialId: 'ser-default-01',
    serialTitle: 'IEEE Computer Magazine',
    issn: '0018-9162',
    volumeNumber: 'Vol. 59',
    issueNumber: 'No. 1',
    expectedDate: '2026-01-15',
    receivedDate: '2026-01-14',
    status: 'RECEIVED',
    notes: 'Checked in at Periodicals Desk',
    createdAt: '2026-01-14T10:00:00.000Z',
    updatedAt: '2026-01-14T10:00:00.000Z',
  },
  {
    id: 'iss-default-02',
    serialId: 'ser-default-01',
    serialTitle: 'IEEE Computer Magazine',
    issn: '0018-9162',
    volumeNumber: 'Vol. 59',
    issueNumber: 'No. 2',
    expectedDate: '2026-02-15',
    receivedDate: null,
    status: 'MISSING',
    notes: 'Claim notice prepared for publisher',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-20T10:00:00.000Z',
  },
];

export function validateIssnFormat(rawIssn: string): string {
  const cleaned = rawIssn?.trim().toUpperCase();
  if (!/^\d{4}-\d{3}[\dX]$/.test(cleaned)) {
    throw new ValidationError(
      `Invalid ISSN format '${rawIssn}'. Expected 8-character hyphenated format XXXX-XXXX (e.g., 0018-9162 or 0317-8471).`
    );
  }
  return cleaned;
}

export class SerialsService {
  private async loadList<T>(configKey: string, fallback: T[]): Promise<T[]> {
    const row = await prisma.systemConfiguration.findUnique({ where: { configKey } });
    if (!row) {
      await prisma.systemConfiguration.create({
        data: {
          configKey,
          configValue: JSON.stringify(fallback),
          dataType: ConfigDataType.JSON,
          category: 'SERIALS',
          description: `Serials store for ${configKey}`,
        },
      });
      return fallback;
    }
    try {
      return JSON.parse(row.configValue) as T[];
    } catch {
      return fallback;
    }
  }

  private async saveList<T>(configKey: string, items: T[], userId?: string): Promise<void> {
    await prisma.systemConfiguration.upsert({
      where: { configKey },
      update: {
        configValue: JSON.stringify(items),
        updatedByUserId: userId || null,
      },
      create: {
        configKey,
        configValue: JSON.stringify(items),
        dataType: ConfigDataType.JSON,
        category: 'SERIALS',
        updatedByUserId: userId || null,
      },
    });
  }

  async getSerials(query?: {
    search?: string;
    frequency?: string;
    status?: string;
  }) {
    const [serials, issues] = await Promise.all([
      this.loadList<SerialRecord>(SERIALS_KEY, DEFAULT_SERIALS),
      this.loadList<SerialIssueRecord>(ISSUES_KEY, DEFAULT_ISSUES),
    ]);

    const filtered = serials.filter((s) => {
      if (query?.frequency && s.frequency !== query.frequency) return false;
      if (query?.status && s.subscriptionStatus !== query.status) return false;
      if (query?.search) {
        const q = query.search.toLowerCase();
        const match =
          s.title.toLowerCase().includes(q) ||
          s.issn.toLowerCase().includes(q) ||
          s.publisher.toLowerCase().includes(q) ||
          s.subject.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    return filtered.map((s) => {
      const serialIssues = issues.filter((i) => i.serialId === s.id);
      return {
        ...s,
        issueStats: {
          totalIssues: serialIssues.length,
          receivedIssues: serialIssues.filter((i) => i.status === 'RECEIVED').length,
          expectedIssues: serialIssues.filter((i) => i.status === 'EXPECTED').length,
          missingIssues: serialIssues.filter((i) => i.status === 'MISSING').length,
        },
      };
    });
  }

  async getSerialById(id: string) {
    const [serials, issues] = await Promise.all([
      this.loadList<SerialRecord>(SERIALS_KEY, DEFAULT_SERIALS),
      this.loadList<SerialIssueRecord>(ISSUES_KEY, DEFAULT_ISSUES),
    ]);
    const serial = serials.find((s) => s.id === id);
    if (!serial) {
      throw new NotFoundError(`Serial with ID '${id}' not found`);
    }
    const serialIssues = issues.filter((i) => i.serialId === id);
    return {
      ...serial,
      issues: serialIssues,
    };
  }

  async createSerial(
    input: {
      issn: string;
      title: string;
      publisher: string;
      subject?: string;
      frequency?: PublicationFrequency;
      subscriptionStartDate: string;
      subscriptionEndDate: string;
      annualSubscriptionCost?: number;
      shelfLocation?: string;
    },
    actor: { userId: string; email: string }
  ) {
    const normalizedIssn = validateIssnFormat(input.issn);
    if (!input.title?.trim()) {
      throw new ValidationError('Journal/serial title is required');
    }
    if (!input.publisher?.trim()) {
      throw new ValidationError('Journal publisher is required');
    }

    const serials = await this.loadList<SerialRecord>(SERIALS_KEY, DEFAULT_SERIALS);
    if (serials.some((s) => s.issn === normalizedIssn)) {
      throw new ConflictError(`Serial with ISSN '${normalizedIssn}' already exists`);
    }

    const created: SerialRecord = {
      id: crypto.randomUUID(),
      issn: normalizedIssn,
      title: input.title.trim(),
      publisher: input.publisher.trim(),
      subject: input.subject?.trim() || 'Academic Periodical',
      frequency: input.frequency || 'MONTHLY',
      subscriptionStartDate: input.subscriptionStartDate || '2026-01-01',
      subscriptionEndDate: input.subscriptionEndDate || '2026-12-31',
      subscriptionStatus: 'ACTIVE',
      renewalCount: 0,
      annualSubscriptionCost: Number(input.annualSubscriptionCost ?? 10000),
      shelfLocation: input.shelfLocation?.trim() || 'PERIODICALS-RACK-A1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    serials.unshift(created);
    await this.saveList(SERIALS_KEY, serials, actor.userId);

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: AuditAction.CREATE,
        entityName: 'Serial',
        entityId: created.id,
        newState: created as unknown as Prisma.InputJsonValue,
      },
    });

    return created;
  }

  async updateSerial(
    id: string,
    input: Partial<{
      title: string;
      publisher: string;
      subject: string;
      frequency: PublicationFrequency;
      subscriptionStartDate: string;
      subscriptionEndDate: string;
      subscriptionStatus: 'ACTIVE' | 'RENEWAL_DUE' | 'EXPIRED' | 'CANCELLED';
      renewSubscription: boolean;
      annualSubscriptionCost: number;
      shelfLocation: string;
    }>,
    actor: { userId: string; email: string }
  ) {
    const serials = await this.loadList<SerialRecord>(SERIALS_KEY, DEFAULT_SERIALS);
    const idx = serials.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new NotFoundError(`Serial with ID '${id}' not found`);
    }

    const previous = { ...serials[idx]! };
    const target = serials[idx]!;

    if (input.title) target.title = input.title.trim();
    if (input.publisher) target.publisher = input.publisher.trim();
    if (input.subject) target.subject = input.subject.trim();
    if (input.frequency) target.frequency = input.frequency;
    if (input.subscriptionStartDate) target.subscriptionStartDate = input.subscriptionStartDate;
    if (input.subscriptionEndDate) target.subscriptionEndDate = input.subscriptionEndDate;
    if (input.subscriptionStatus) target.subscriptionStatus = input.subscriptionStatus;
    if (input.annualSubscriptionCost !== undefined) {
      target.annualSubscriptionCost = Number(input.annualSubscriptionCost);
    }
    if (input.shelfLocation) target.shelfLocation = input.shelfLocation.trim();
    if (input.renewSubscription) {
      target.renewalCount += 1;
      target.subscriptionStatus = 'ACTIVE';
    }
    target.updatedAt = new Date().toISOString();

    await this.saveList(SERIALS_KEY, serials, actor.userId);

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: AuditAction.UPDATE,
        entityName: 'Serial',
        entityId: target.id,
        previousState: previous as unknown as Prisma.InputJsonValue,
        newState: target as unknown as Prisma.InputJsonValue,
      },
    });

    return target;
  }

  async createIssue(
    serialId: string,
    input: {
      volumeNumber: string;
      issueNumber: string;
      expectedDate: string;
      status?: 'EXPECTED' | 'RECEIVED' | 'MISSING' | 'LATE';
      receivedDate?: string;
      notes?: string;
    },
    actor: { userId: string; email: string }
  ) {
    const serials = await this.loadList<SerialRecord>(SERIALS_KEY, DEFAULT_SERIALS);
    const serial = serials.find((s) => s.id === serialId);
    if (!serial) {
      throw new NotFoundError(`Serial with ID '${serialId}' not found`);
    }
    if (!input.volumeNumber?.trim() || !input.issueNumber?.trim()) {
      throw new ValidationError('volumeNumber and issueNumber are required');
    }

    const issues = await this.loadList<SerialIssueRecord>(ISSUES_KEY, DEFAULT_ISSUES);
    const status = input.status || 'EXPECTED';
    const created: SerialIssueRecord = {
      id: crypto.randomUUID(),
      serialId: serial.id,
      serialTitle: serial.title,
      issn: serial.issn,
      volumeNumber: input.volumeNumber.trim(),
      issueNumber: input.issueNumber.trim(),
      expectedDate: input.expectedDate || new Date().toISOString().slice(0, 10),
      receivedDate:
        status === 'RECEIVED'
          ? input.receivedDate || new Date().toISOString().slice(0, 10)
          : null,
      status,
      notes: input.notes?.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    issues.unshift(created);
    await this.saveList(ISSUES_KEY, issues, actor.userId);

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: AuditAction.CREATE,
        entityName: 'SerialIssue',
        entityId: created.id,
        newState: created as unknown as Prisma.InputJsonValue,
      },
    });

    return created;
  }

  async updateIssue(
    issueId: string,
    input: {
      status?: 'EXPECTED' | 'RECEIVED' | 'MISSING' | 'LATE';
      receivedDate?: string;
      notes?: string;
    },
    actor: { userId: string; email: string }
  ) {
    const issues = await this.loadList<SerialIssueRecord>(ISSUES_KEY, DEFAULT_ISSUES);
    const idx = issues.findIndex((i) => i.id === issueId);
    if (idx === -1) {
      throw new NotFoundError(`Serial issue '${issueId}' not found`);
    }

    const previous = { ...issues[idx]! };
    const target = issues[idx]!;
    if (input.status) {
      target.status = input.status;
      if (input.status === 'RECEIVED' && !target.receivedDate) {
        target.receivedDate = input.receivedDate || new Date().toISOString().slice(0, 10);
      }
    }
    if (input.receivedDate !== undefined) target.receivedDate = input.receivedDate;
    if (input.notes !== undefined) target.notes = input.notes;
    target.updatedAt = new Date().toISOString();

    await this.saveList(ISSUES_KEY, issues, actor.userId);

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: AuditAction.UPDATE,
        entityName: 'SerialIssue',
        entityId: target.id,
        previousState: previous as unknown as Prisma.InputJsonValue,
        newState: target as unknown as Prisma.InputJsonValue,
      },
    });

    return target;
  }

  async getSerialsReport() {
    const [serials, issues] = await Promise.all([
      this.loadList<SerialRecord>(SERIALS_KEY, DEFAULT_SERIALS),
      this.loadList<SerialIssueRecord>(ISSUES_KEY, DEFAULT_ISSUES),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    // Identify missing issues (explicitly MISSING or EXPECTED with expectedDate in the past)
    const missingIssues = issues.filter(
      (i) => i.status === 'MISSING' || (i.status === 'EXPECTED' && i.expectedDate < today)
    );

    return {
      summary: {
        totalSubscriptions: serials.length,
        activeSubscriptions: serials.filter((s) => s.subscriptionStatus === 'ACTIVE').length,
        renewalDueSubscriptions: serials.filter((s) => s.subscriptionStatus === 'RENEWAL_DUE').length,
        expiredSubscriptions: serials.filter((s) => s.subscriptionStatus === 'EXPIRED').length,
        totalTrackedIssues: issues.length,
        receivedIssuesCount: issues.filter((i) => i.status === 'RECEIVED').length,
        expectedIssuesCount: issues.filter((i) => i.status === 'EXPECTED').length,
        missingIssuesCount: missingIssues.length,
        totalAnnualBudget: serials.reduce((sum, s) => sum + s.annualSubscriptionCost, 0),
      },
      missingIssues,
      subscriptions: serials,
    };
  }
}

export const serialsService = new SerialsService();

