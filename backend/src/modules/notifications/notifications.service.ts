import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import {
  Prisma,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  ConfigDataType,
} from '@prisma/client';
import { NotFoundError, ValidationError } from '../../utils/errors.js';

// ============================================================================
// Provider-Neutral Notification Adapter Interfaces & Mock Implementations
// ============================================================================

export interface NotificationDispatchResult {
  providerName: string;
  providerMode: 'MOCK_EMULATOR';
  externalDeliveryClaimed: false;
  success: boolean;
  messageId: string;
  dispatchedAt: string;
  renderedPayload?: string;
  errorReason?: string;
}

export interface NotificationProviderAdapter {
  readonly channel: NotificationChannel;
  readonly providerName: string;
  dispatch(params: {
    recipient: string;
    subject: string;
    message: string;
    simulateFailure?: boolean;
  }): Promise<NotificationDispatchResult>;
}

export class MockEmailNotificationAdapter implements NotificationProviderAdapter {
  readonly channel = NotificationChannel.EMAIL;
  readonly providerName = 'MockSmtpEmailAdapter (Provider-Neutral)';

  async dispatch(params: {
    recipient: string;
    subject: string;
    message: string;
    simulateFailure?: boolean;
  }): Promise<NotificationDispatchResult> {
    if (
      params.simulateFailure ||
      params.recipient.toLowerCase().includes('fail@') ||
      !params.recipient.includes('@')
    ) {
      return {
        providerName: this.providerName,
        providerMode: 'MOCK_EMULATOR',
        externalDeliveryClaimed: false,
        success: false,
        messageId: `ERR-EMAIL-${Date.now()}`,
        dispatchedAt: new Date().toISOString(),
        errorReason: 'MOCK_SMTP_DELIVERY_FAILURE: Simulated transient relay rejection or invalid address',
      };
    }

    return {
      providerName: this.providerName,
      providerMode: 'MOCK_EMULATOR',
      externalDeliveryClaimed: false,
      success: true,
      messageId: `<mock-email-${crypto.randomUUID()}@smartlib.local>`,
      dispatchedAt: new Date().toISOString(),
      renderedPayload: `To: ${params.recipient}\nSubject: ${params.subject}\n\n${params.message}`,
    };
  }
}

export class MockSmsNotificationAdapter implements NotificationProviderAdapter {
  readonly channel = NotificationChannel.SMS;
  readonly providerName = 'MockRestSmsGatewayAdapter (Provider-Neutral)';

  async dispatch(params: {
    recipient: string;
    subject: string;
    message: string;
    simulateFailure?: boolean;
  }): Promise<NotificationDispatchResult> {
    if (params.simulateFailure || params.recipient.includes('000000')) {
      return {
        providerName: this.providerName,
        providerMode: 'MOCK_EMULATOR',
        externalDeliveryClaimed: false,
        success: false,
        messageId: `ERR-SMS-${Date.now()}`,
        dispatchedAt: new Date().toISOString(),
        errorReason: 'MOCK_SMS_GATEWAY_FAILURE: Simulated carrier timeout or invalid number',
      };
    }

    return {
      providerName: this.providerName,
      providerMode: 'MOCK_EMULATOR',
      externalDeliveryClaimed: false,
      success: true,
      messageId: `SM-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
      dispatchedAt: new Date().toISOString(),
      renderedPayload: `[SMARTLIB SMS -> ${params.recipient}] ${params.subject}: ${params.message.slice(0, 140)}`,
    };
  }
}

export class MockPrintNotificationAdapter implements NotificationProviderAdapter {
  readonly channel = NotificationChannel.PRINT;
  readonly providerName = 'MockThermalSlipPrintAdapter (Provider-Neutral)';

  async dispatch(params: {
    recipient: string;
    subject: string;
    message: string;
    simulateFailure?: boolean;
  }): Promise<NotificationDispatchResult> {
    if (params.simulateFailure || params.recipient.toUpperCase().includes('PAPER_OUT')) {
      return {
        providerName: this.providerName,
        providerMode: 'MOCK_EMULATOR',
        externalDeliveryClaimed: false,
        success: false,
        messageId: `ERR-PRINT-${Date.now()}`,
        dispatchedAt: new Date().toISOString(),
        errorReason: 'MOCK_PRINTER_FAULT: Simulated paper-out or offline spooler',
      };
    }

    const slip = [
      '========================================',
      '       SMARTLIB INSTITUTIONAL SLIP      ',
      '========================================',
      `RECIPIENT : ${params.recipient}`,
      `NOTICE    : ${params.subject}`,
      `DATE      : ${new Date().toISOString()}`,
      '----------------------------------------',
      params.message,
      '========================================',
    ].join('\n');

    return {
      providerName: this.providerName,
      providerMode: 'MOCK_EMULATOR',
      externalDeliveryClaimed: false,
      success: true,
      messageId: `PRN-JOB-${Date.now()}`,
      dispatchedAt: new Date().toISOString(),
      renderedPayload: slip,
    };
  }
}

export interface UserNotificationPreferences {
  memberId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  printEnabled: boolean;
  inAppEnabled: boolean;
  enabledTypes: NotificationType[];
  updatedAt: string;
}

export interface NotificationQueueMeta {
  notificationId: string;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  providerName: string | null;
  providerMessageId: string | null;
  renderedSlipOrPayload: string | null;
  lastAttemptAt: string | null;
}

const PREFS_KEY = 'PHASE5B_NOTIFICATION_PREFERENCES';
const QUEUE_META_KEY = 'PHASE5B_NOTIFICATION_QUEUE_META';

export class NotificationsService {
  private readonly emailAdapter = new MockEmailNotificationAdapter();
  private readonly smsAdapter = new MockSmsNotificationAdapter();
  private readonly printAdapter = new MockPrintNotificationAdapter();

  private async getPrefsMap(): Promise<Record<string, UserNotificationPreferences>> {
    const row = await prisma.systemConfiguration.findUnique({ where: { configKey: PREFS_KEY } });
    if (!row) return {};
    try {
      return JSON.parse(row.configValue) as Record<string, UserNotificationPreferences>;
    } catch {
      return {};
    }
  }

  private async savePrefsMap(
    map: Record<string, UserNotificationPreferences>,
    actorUserId?: string
  ): Promise<void> {
    await prisma.systemConfiguration.upsert({
      where: { configKey: PREFS_KEY },
      update: { configValue: JSON.stringify(map), updatedByUserId: actorUserId || null },
      create: {
        configKey: PREFS_KEY,
        configValue: JSON.stringify(map),
        dataType: ConfigDataType.JSON,
        category: 'NOTIFICATIONS',
        description: 'Per-user notification channel & alert preferences',
        updatedByUserId: actorUserId || null,
      },
    });
  }

  private async getQueueMetaMap(): Promise<Record<string, NotificationQueueMeta>> {
    const row = await prisma.systemConfiguration.findUnique({ where: { configKey: QUEUE_META_KEY } });
    if (!row) return {};
    try {
      return JSON.parse(row.configValue) as Record<string, NotificationQueueMeta>;
    } catch {
      return {};
    }
  }

  private async saveQueueMetaMap(
    map: Record<string, NotificationQueueMeta>,
    actorUserId?: string
  ): Promise<void> {
    await prisma.systemConfiguration.upsert({
      where: { configKey: QUEUE_META_KEY },
      update: { configValue: JSON.stringify(map), updatedByUserId: actorUserId || null },
      create: {
        configKey: QUEUE_META_KEY,
        configValue: JSON.stringify(map),
        dataType: ConfigDataType.JSON,
        category: 'NOTIFICATIONS',
        description: 'Notification retry and provider telemetry metadata',
        updatedByUserId: actorUserId || null,
      },
    });
  }

  async getPreferences(memberId: string): Promise<UserNotificationPreferences> {
    const map = await this.getPrefsMap();
    if (map[memberId]) {
      return map[memberId];
    }
    return {
      memberId,
      emailEnabled: true,
      smsEnabled: true,
      printEnabled: true,
      inAppEnabled: true,
      enabledTypes: [
        'DUE_REMINDER',
        'OVERDUE_ALERT',
        'FINE_NOTICE',
        'HOLD_AVAILABLE',
        'GATE_ALARM',
        'SYSTEM_ALERT',
      ],
      updatedAt: new Date().toISOString(),
    };
  }

  async updatePreferences(
    memberId: string,
    input: Partial<Omit<UserNotificationPreferences, 'memberId' | 'updatedAt'>>,
    actor: { userId: string; email: string }
  ): Promise<UserNotificationPreferences> {
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) {
      throw new NotFoundError(`Member '${memberId}' not found`);
    }

    const map = await this.getPrefsMap();
    const current = await this.getPreferences(memberId);
    const updated: UserNotificationPreferences = {
      memberId,
      emailEnabled: input.emailEnabled ?? current.emailEnabled,
      smsEnabled: input.smsEnabled ?? current.smsEnabled,
      printEnabled: input.printEnabled ?? current.printEnabled,
      inAppEnabled: input.inAppEnabled ?? current.inAppEnabled,
      enabledTypes: input.enabledTypes ?? current.enabledTypes,
      updatedAt: new Date().toISOString(),
    };

    map[memberId] = updated;
    await this.savePrefsMap(map, actor.userId);

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: 'UPDATE',
        entityName: 'NotificationPreference',
        entityId: memberId,
        previousState: current as unknown as Prisma.InputJsonValue,
        newState: updated as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async enqueueNotification(
    input: {
      memberId: string;
      type?: NotificationType;
      channel?: NotificationChannel;
      recipient?: string;
      subject: string;
      message: string;
      maxRetries?: number;
    },
    actor: { userId: string; email: string }
  ) {
    const member = await prisma.member.findUnique({ where: { id: input.memberId } });
    if (!member) {
      throw new NotFoundError(`Member '${input.memberId}' not found`);
    }

    const channel = input.channel || NotificationChannel.EMAIL;
    const type = input.type || NotificationType.DUE_REMINDER;
    const prefs = await this.getPreferences(member.id);

    if (
      (channel === 'EMAIL' && !prefs.emailEnabled) ||
      (channel === 'SMS' && !prefs.smsEnabled) ||
      (channel === 'PRINT' && !prefs.printEnabled) ||
      (channel === 'IN_APP' && !prefs.inAppEnabled)
    ) {
      throw new ValidationError(
        `Member '${member.cardNumber}' has opted out of ${channel} notifications in preferences`
      );
    }

    const recipient =
      input.recipient?.trim() ||
      (channel === 'SMS'
        ? member.phoneNumber || '+919999900000'
        : channel === 'PRINT'
          ? `CIRC-PRINTER-01 (${member.cardNumber})`
          : member.email);

    const created = await prisma.notification.create({
      data: {
        memberId: member.id,
        type,
        channel,
        recipient,
        subject: input.subject.trim(),
        message: input.message.trim(),
        status: NotificationStatus.PENDING,
      },
    });

    const metaMap = await this.getQueueMetaMap();
    const meta: NotificationQueueMeta = {
      notificationId: created.id,
      retryCount: 0,
      maxRetries: input.maxRetries ?? 3,
      lastError: null,
      providerName: null,
      providerMessageId: null,
      renderedSlipOrPayload: null,
      lastAttemptAt: null,
    };
    metaMap[created.id] = meta;
    await this.saveQueueMetaMap(metaMap, actor.userId);

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: 'CREATE',
        entityName: 'Notification',
        entityId: created.id,
        newState: {
          memberId: created.memberId,
          channel: created.channel,
          type: created.type,
          recipient: created.recipient,
          status: created.status,
        },
      },
    });

    return {
      ...created,
      queueMeta: meta,
    };
  }

  async dispatchNotification(
    notificationId: string,
    options: { simulateFailure?: boolean; overrideRecipient?: string } = {},
    actor: { userId: string; email: string }
  ) {
    const existing = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!existing) {
      throw new NotFoundError(`Notification '${notificationId}' not found`);
    }

    const recipient = options.overrideRecipient?.trim() || existing.recipient;
    const adapter: NotificationProviderAdapter =
      existing.channel === 'SMS'
        ? this.smsAdapter
        : existing.channel === 'PRINT'
          ? this.printAdapter
          : this.emailAdapter;

    const dispatchResult = await adapter.dispatch({
      recipient,
      subject: existing.subject,
      message: existing.message,
      simulateFailure: options.simulateFailure,
    });

    const metaMap = await this.getQueueMetaMap();
    const currentMeta = metaMap[existing.id] || {
      notificationId: existing.id,
      retryCount: 0,
      maxRetries: 3,
      lastError: null,
      providerName: null,
      providerMessageId: null,
      renderedSlipOrPayload: null,
      lastAttemptAt: null,
    };

    const nextStatus = dispatchResult.success
      ? NotificationStatus.SENT
      : NotificationStatus.FAILED;

    const updated = await prisma.notification.update({
      where: { id: existing.id },
      data: {
        recipient,
        status: nextStatus,
        sentAt: dispatchResult.success ? new Date() : null,
      },
    });

    const updatedMeta: NotificationQueueMeta = {
      ...currentMeta,
      retryCount: dispatchResult.success ? currentMeta.retryCount : currentMeta.retryCount + 1,
      lastError: dispatchResult.errorReason || null,
      providerName: dispatchResult.providerName,
      providerMessageId: dispatchResult.messageId,
      renderedSlipOrPayload: dispatchResult.renderedPayload || null,
      lastAttemptAt: dispatchResult.dispatchedAt,
    };
    metaMap[existing.id] = updatedMeta;
    await this.saveQueueMetaMap(metaMap, actor.userId);

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: 'UPDATE',
        entityName: 'Notification',
        entityId: existing.id,
        previousState: { status: existing.status, retryCount: currentMeta.retryCount },
        newState: {
          status: updated.status,
          channel: updated.channel,
          recipient: updated.recipient,
          providerName: dispatchResult.providerName,
          providerMessageId: dispatchResult.messageId,
          retryCount: updatedMeta.retryCount,
          lastError: updatedMeta.lastError,
        },
      },
    });

    return {
      ...updated,
      queueMeta: updatedMeta,
      dispatchResult,
    };
  }

  async retryFailedNotification(
    notificationId: string,
    options: { overrideRecipient?: string; simulateFailure?: boolean } = {},
    actor: { userId: string; email: string }
  ) {
    const existing = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!existing) {
      throw new NotFoundError(`Notification '${notificationId}' not found`);
    }
    if (existing.status !== NotificationStatus.FAILED) {
      throw new ValidationError(
        `Only FAILED notifications can be retried (current status: ${existing.status})`
      );
    }

    const metaMap = await this.getQueueMetaMap();
    const currentMeta = metaMap[existing.id] || {
      notificationId: existing.id,
      retryCount: 1,
      maxRetries: 3,
      lastError: 'Previous failure',
      providerName: null,
      providerMessageId: null,
      renderedSlipOrPayload: null,
      lastAttemptAt: null,
    };

    if (currentMeta.retryCount > currentMeta.maxRetries) {
      throw new ValidationError(
        `Notification '${notificationId}' has exceeded maxRetries (${currentMeta.maxRetries})`
      );
    }

    // Transition FAILED -> PENDING before re-dispatching
    await prisma.notification.update({
      where: { id: existing.id },
      data: {
        status: NotificationStatus.PENDING,
        ...(options.overrideRecipient ? { recipient: options.overrideRecipient.trim() } : {}),
      },
    });

    return this.dispatchNotification(
      notificationId,
      {
        overrideRecipient: options.overrideRecipient,
        simulateFailure: Boolean(options.simulateFailure),
      },
      actor
    );
  }

  async listQueue(memberId?: string, status?: NotificationStatus) {
    const where: Record<string, unknown> = {};
    if (memberId) where.memberId = memberId;
    if (status) where.status = status;

    const [items, metaMap] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          member: { select: { id: true, cardNumber: true, firstName: true, lastName: true } },
        },
      }),
      this.getQueueMetaMap(),
    ]);

    const enriched = items.map((n) => ({
      ...n,
      queueMeta: metaMap[n.id] || {
        notificationId: n.id,
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        providerName: null,
        providerMessageId: null,
        renderedSlipOrPayload: null,
        lastAttemptAt: null,
      },
    }));

    return {
      summary: {
        total: enriched.length,
        pending: enriched.filter((i) => i.status === 'PENDING').length,
        sent: enriched.filter((i) => i.status === 'SENT').length,
        failed: enriched.filter((i) => i.status === 'FAILED').length,
        retriedCount: enriched.filter((i) => i.queueMeta.retryCount > 0).length,
      },
      adapters: [
        { channel: 'EMAIL', providerName: this.emailAdapter.providerName, mode: 'MOCK_EMULATOR' },
        { channel: 'SMS', providerName: this.smsAdapter.providerName, mode: 'MOCK_EMULATOR' },
        { channel: 'PRINT', providerName: this.printAdapter.providerName, mode: 'MOCK_EMULATOR' },
      ],
      items: enriched,
    };
  }
}

export const notificationsService = new NotificationsService();
