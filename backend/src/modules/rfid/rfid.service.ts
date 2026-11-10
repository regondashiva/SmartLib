import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { RFIDTagType, InventoryScanStatus } from '@prisma/client';

export interface AssignTagInput {
  epc: string;
  tid?: string;
  tagType?: RFIDTagType;
  easArmed?: boolean;
  bookItemId?: string;
  accessionNumber?: string;
}

export interface GateEventInput {
  deviceId?: string;
  deviceCode?: string;
  device_code?: string;
  tagEpc?: string;
  tag_epc?: string;
  bookItemId?: string;
  book_item_id?: string;
  alarmTriggered?: boolean;
  alarm_triggered?: boolean;
  footfallCount?: number;
  footfall_count?: number;
  direction?: 'ENTRY' | 'EXIT';
  offlineBuffered?: boolean;
  cctvTimestampRef?: string;
  cctv_timestamp_ref?: string;
}

export function generateSyntheticCctvSnapshot(params: {
  cctvRef: string;
  deviceCode: string;
  direction: string;
  tagEpc: string | null;
  accessionNumber: string | null;
  alarmTriggered: boolean;
  footfallCount: number;
  timestampIso: string;
}) {
  const borderColor = params.alarmTriggered ? '#EF4444' : '#10B981';
  const statusBanner = params.alarmTriggered
    ? 'ALARM TRIGGERED — UNAUTHORIZED ITEM DETECTED'
    : 'AUTHORIZED GATE TRANSIT';
  const svgMarkup = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">',
    '<rect width="640" height="360" fill="#0F172A"/>',
    `<rect x="14" y="14" width="612" height="332" fill="none" stroke="${borderColor}" stroke-width="4"/>`,
    '<rect x="28" y="28" width="584" height="44" fill="#1E293B" rx="4"/>',
    `<text x="42" y="55" fill="#F8FAFC" font-family="monospace" font-size="15" font-weight="bold">[SYNTHETIC MOCK CCTV] ${params.cctvRef}</text>`,
    `<text x="42" y="102" fill="${borderColor}" font-family="monospace" font-size="16" font-weight="bold">${statusBanner}</text>`,
    `<text x="42" y="140" fill="#E2E8F0" font-family="monospace" font-size="14">GATE DEVICE : ${params.deviceCode}</text>`,
    `<text x="42" y="168" fill="#E2E8F0" font-family="monospace" font-size="14">DIRECTION   : ${params.direction} (Footfall #${params.footfallCount})</text>`,
    `<text x="42" y="196" fill="#E2E8F0" font-family="monospace" font-size="14">RFID EPC    : ${params.tagEpc || 'NONE (FOOTFALL ONLY)'}</text>`,
    `<text x="42" y="224" fill="#E2E8F0" font-family="monospace" font-size="14">ACCESSION # : ${params.accessionNumber || 'UNCATALOGUED / N/A'}</text>`,
    `<rect x="420" y="120" width="170" height="150" fill="none" stroke="${borderColor}" stroke-dasharray="6,4" stroke-width="2"/>`,
    `<text x="435" y="198" fill="${borderColor}" font-family="monospace" font-size="12">TARGET PEDESTAL ZONE</text>`,
    `<text x="42" y="322" fill="#94A3B8" font-family="monospace" font-size="12">CAPTURED AT : ${params.timestampIso} | MODE: MOCK_SYNTHETIC_FRAME</text>`,
    '</svg>',
  ].join('');

  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svgMarkup, 'utf-8').toString('base64')}`;
  return {
    cctvRef: params.cctvRef,
    mimeType: 'image/svg+xml',
    width: 640,
    height: 360,
    isSyntheticMock: true,
    svgMarkup,
    dataUri,
  };
}

export interface InventorySessionInput {
  targetLocation: string;
  deviceId?: string;
  deviceCode?: string;
  scannedEpcs: string[];
}

export class RFIDService {
  async getDevices() {
    const devices = await prisma.rFIDDevice.findMany({
      orderBy: { name: 'asc' },
    });

    return {
      mode: env.MOCK_RFID_MODE ? 'MOCK_EMULATOR' : 'HARDWARE_LIVE',
      middlewareUrl: env.RFID_MIDDLEWARE_URL,
      devices,
    };
  }

  async getTags(page = 1, limit = 20, epc?: string) {
    const skip = (page - 1) * limit;
    const where = epc ? { epc: epc.trim().toUpperCase() } : {};

    const [total, tags] = await Promise.all([
      prisma.rFIDTag.count({ where }),
      prisma.rFIDTag.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          bookItem: {
            include: {
              book: {
                select: {
                  id: true,
                  title: true,
                  isbn13: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const formatted = tags.map((t) => ({
      id: t.id,
      epc: t.epc,
      tid: t.tid,
      tagType: t.tagType,
      easArmed: t.easArmed,
      status: t.status,
      encodedAt: t.encodedAt,
      associatedItem: t.bookItem
        ? {
            id: t.bookItem.id,
            accessionNumber: t.bookItem.accessionNumber,
            title: t.bookItem.book.title,
            isbn13: t.bookItem.book.isbn13,
            shelfLocation: t.bookItem.shelfLocation,
            status: t.bookItem.status,
          }
        : null,
    }));

    return {
      items: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async assignTag(
    input: AssignTagInput,
    actor?: { userId: string; email: string; ipAddress?: string }
  ) {
    const normalizedEpc = input.epc?.trim().toUpperCase();
    if (!normalizedEpc || normalizedEpc.length < 8) {
      throw new AppError('Valid RFID EPC identifier (minimum 8 characters) is required', 400);
    }

    const existingTag = await prisma.rFIDTag.findUnique({
      where: { epc: normalizedEpc },
    });

    if (existingTag) {
      throw new AppError(`Duplicate RFID EPC detected: ${normalizedEpc} is already registered`, 409);
    }

    let targetBookItem = null;
    if (input.bookItemId || input.accessionNumber) {
      targetBookItem = await prisma.bookItem.findFirst({
        where: input.bookItemId
          ? { id: input.bookItemId, deletedAt: null }
          : { accessionNumber: input.accessionNumber, deletedAt: null },
        include: { book: true, rfidTag: true },
      });

      if (!targetBookItem) {
        throw new AppError('Target book copy not found for RFID tag assignment', 404);
      }

      if (targetBookItem.rfidTagId) {
        throw new AppError(
          `Book copy ${targetBookItem.accessionNumber} already has RFID tag ${targetBookItem.rfidTag?.epc ?? targetBookItem.rfidTagId} assigned`,
          409
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdTag = await tx.rFIDTag.create({
        data: {
          epc: normalizedEpc,
          tid: input.tid?.trim().toUpperCase() || `TID-${normalizedEpc.slice(-12)}`,
          tagType: input.tagType || 'UHF_EPC_GEN2',
          easArmed: input.easArmed ?? true,
          status: targetBookItem ? 'ACTIVE' : 'UNASSIGNED',
          encodedAt: new Date(),
        },
      });

      let updatedItem = null;
      if (targetBookItem) {
        updatedItem = await tx.bookItem.update({
          where: { id: targetBookItem.id },
          data: { rfidTagId: createdTag.id },
          include: {
            book: {
              select: { id: true, title: true, isbn13: true },
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor?.userId ?? null,
          actorEmail: actor?.email ?? 'system@smartlib.local',
          action: 'CREATE',
          entityName: 'RFIDTag',
          entityId: createdTag.id,
          newState: {
            epc: createdTag.epc,
            tid: createdTag.tid,
            status: createdTag.status,
            easArmed: createdTag.easArmed,
            bookItemId: updatedItem?.id ?? null,
            accessionNumber: updatedItem?.accessionNumber ?? null,
          },
          ipAddress: actor?.ipAddress ?? null,
        },
      });

      return {
        tag: createdTag,
        associatedItem: updatedItem
          ? {
              id: updatedItem.id,
              accessionNumber: updatedItem.accessionNumber,
              title: updatedItem.book.title,
              isbn13: updatedItem.book.isbn13,
              shelfLocation: updatedItem.shelfLocation,
            }
          : null,
        hardwareMode: env.MOCK_RFID_MODE ? 'MOCK_EMULATOR' : 'HARDWARE_LIVE',
      };
    }, { timeout: 30000, maxWait: 15000 });

    return result;
  }

  async reassignTag(
    tagIdOrEpc: string,
    input: {
      bookItemId?: string;
      accessionNumber?: string;
      reason?: string;
    },
    actor?: { userId: string; email: string; ipAddress?: string }
  ) {
    const tag = await prisma.rFIDTag.findFirst({
      where: {
        OR: [{ id: tagIdOrEpc }, { epc: tagIdOrEpc.trim().toUpperCase() }],
      },
      include: {
        bookItem: { select: { id: true, accessionNumber: true } },
      },
    });

    if (!tag) {
      throw new AppError(`RFID tag '${tagIdOrEpc}' not found`, 404);
    }

    if (!input.bookItemId && !input.accessionNumber) {
      throw new AppError('bookItemId or accessionNumber is required for tag reassignment', 400);
    }

    const newBookItem = await prisma.bookItem.findFirst({
      where: input.bookItemId
        ? { id: input.bookItemId, deletedAt: null }
        : { accessionNumber: input.accessionNumber!.trim(), deletedAt: null },
      include: { book: { select: { id: true, title: true, isbn13: true } }, rfidTag: true },
    });

    if (!newBookItem) {
      throw new AppError('Target book copy not found for RFID tag reassignment', 404);
    }

    if (newBookItem.rfidTagId && newBookItem.rfidTagId !== tag.id) {
      throw new AppError(
        `Target book copy ${newBookItem.accessionNumber} already has another RFID tag assigned`,
        409
      );
    }

    const previousBookItem = tag.bookItem;

    return prisma.$transaction(async (tx) => {
      if (previousBookItem && previousBookItem.id !== newBookItem.id) {
        await tx.bookItem.update({
          where: { id: previousBookItem.id },
          data: { rfidTagId: null },
        });
      }

      const updatedTag = await tx.rFIDTag.update({
        where: { id: tag.id },
        data: { status: 'ACTIVE', encodedAt: new Date() },
      });

      const updatedItem = await tx.bookItem.update({
        where: { id: newBookItem.id },
        data: { rfidTagId: tag.id },
        include: { book: { select: { id: true, title: true, isbn13: true } } },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor?.userId ?? null,
          actorEmail: actor?.email ?? 'system@smartlib.local',
          action: 'UPDATE',
          entityName: 'RFIDTag',
          entityId: tag.id,
          previousState: {
            epc: tag.epc,
            bookItemId: previousBookItem?.id ?? null,
            accessionNumber: previousBookItem?.accessionNumber ?? null,
          },
          newState: {
            epc: tag.epc,
            bookItemId: updatedItem.id,
            accessionNumber: updatedItem.accessionNumber,
            reason: input.reason || 'Administrative RFID tag reassignment',
          },
          ipAddress: actor?.ipAddress ?? null,
        },
      });

      return {
        tag: updatedTag,
        previousItem: previousBookItem,
        associatedItem: {
          id: updatedItem.id,
          accessionNumber: updatedItem.accessionNumber,
          title: updatedItem.book.title,
          isbn13: updatedItem.book.isbn13,
          shelfLocation: updatedItem.shelfLocation,
        },
      };
    }, { timeout: 30000, maxWait: 15000 });
  }

  async recordGateEvent(
    input: GateEventInput,
    actor?: { userId: string; email: string; ipAddress?: string }
  ) {
    const deviceCode = input.deviceCode || input.device_code;
    const tagEpc = (input.tagEpc || input.tag_epc)?.trim().toUpperCase();
    const explicitBookItemId = input.bookItemId || input.book_item_id;
    const explicitAlarm =
      typeof input.alarmTriggered === 'boolean'
        ? input.alarmTriggered
        : typeof input.alarm_triggered === 'boolean'
          ? input.alarm_triggered
          : undefined;
    const footfallCount = input.footfallCount ?? input.footfall_count ?? 1;
    const cctvRefInput = input.cctvTimestampRef || input.cctv_timestamp_ref;

    let device = null;
    if (input.deviceId) {
      device = await prisma.rFIDDevice.findUnique({ where: { id: input.deviceId } });
    } else if (deviceCode) {
      device = await prisma.rFIDDevice.findUnique({ where: { deviceCode } });
    }

    if (!device) {
      device = await prisma.rFIDDevice.findFirst({
        where: { deviceType: 'SECURITY_GATE' },
      });
    }

    if (!device) {
      device = await prisma.rFIDDevice.findFirst();
    }

    if (!device) {
      throw new AppError('No RFID security gate device registered in system', 404);
    }

    let tag = null;
    if (tagEpc) {
      tag = await prisma.rFIDTag.findUnique({
        where: { epc: tagEpc },
        include: {
          bookItem: {
            include: {
              book: { select: { id: true, title: true, isbn13: true } },
            },
          },
        },
      });
    }

    const resolvedBookItemId = explicitBookItemId || tag?.bookItem?.id || null;
    const resolvedAccessionNumber = tag?.bookItem?.accessionNumber || null;
    const easArmed = tag ? tag.easArmed : Boolean(tagEpc);
    const alarmTriggered = explicitAlarm !== undefined ? explicitAlarm : easArmed;
    const direction: 'ENTRY' | 'EXIT' =
      input.direction && String(input.direction).toUpperCase() === 'ENTRY' ? 'ENTRY' : 'EXIT';
    const cctvTimestampRef =
      cctvRefInput ||
      `CAM-GATE-01_${new Date().toISOString().replace(/[:.]/g, '-')}`;

    const cctvImageAttachment = generateSyntheticCctvSnapshot({
      cctvRef: cctvTimestampRef,
      deviceCode: device.deviceCode,
      direction,
      tagEpc: tagEpc ?? null,
      accessionNumber: resolvedAccessionNumber,
      alarmTriggered,
      footfallCount,
      timestampIso: new Date().toISOString(),
    });

    const gateEvent = await prisma.$transaction(async (tx) => {
      const created = await tx.gateEvent.create({
        data: {
          deviceId: device.id,
          tagEpc: tagEpc ?? null,
          bookItemId: resolvedBookItemId,
          alarmTriggered,
          alarmResolved: false,
          footfallCount,
          cctvTimestampRef,
        },
        include: {
          device: {
            select: { id: true, deviceCode: true, name: true, location: true },
          },
          bookItem: {
            include: {
              book: { select: { id: true, title: true, isbn13: true } },
            },
          },
        },
      });

      // Record footfall entry/exit telemetry in DeviceEvent
      await tx.deviceEvent.create({
        data: {
          deviceId: device.id,
          eventType: direction === 'ENTRY' ? 'FOOTFALL_ENTRY' : 'FOOTFALL_EXIT',
          payload: {
            gateEventId: created.id,
            direction,
            footfallCount,
            tagEpc: tagEpc ?? null,
            accessionNumber: resolvedAccessionNumber,
            easArmed,
            alarmTriggered,
            unauthorizedItemDetected: alarmTriggered,
            offlineSecurityBitRead: true,
            offlineBuffered: Boolean(input.offlineBuffered),
            cctvTimestampRef,
          },
        },
      });

      if (alarmTriggered) {
        await tx.auditLog.create({
          data: {
            actorUserId: actor?.userId ?? null,
            actorEmail: actor?.email ?? 'rfid-gate@smartlib.local',
            action: 'CREATE',
            entityName: 'GateEvent',
            entityId: created.id,
            newState: {
              deviceCode: device.deviceCode,
              tagEpc: created.tagEpc,
              bookItemId: created.bookItemId,
              accessionNumber: resolvedAccessionNumber,
              direction,
              easArmed,
              unauthorizedItemDetected: true,
              alarmTriggered: created.alarmTriggered,
              cctvTimestampRef: created.cctvTimestampRef,
              footfallCount: created.footfallCount,
            },
            ipAddress: actor?.ipAddress ?? null,
          },
        });
      }

      return created;
    }, { timeout: 30000, maxWait: 15000 });

    return {
      ...gateEvent,
      accessionNumber: resolvedAccessionNumber,
      direction,
      easArmed,
      unauthorizedItemDetected: alarmTriggered,
      offlineSecurityBitRead: true,
      cctvImageAttachment,
      hardwareMode: env.MOCK_RFID_MODE ? 'MOCK_EMULATOR' : 'HARDWARE_LIVE',
    };
  }

  async getGateEventCctvSnapshot(gateEventId: string) {
    const evt = await prisma.gateEvent.findUnique({
      where: { id: gateEventId },
      include: {
        device: { select: { deviceCode: true, name: true, location: true } },
        bookItem: { select: { accessionNumber: true, book: { select: { title: true } } } },
      },
    });
    if (!evt) {
      throw new AppError(`Security gate event '${gateEventId}' not found`, 404);
    }

    const cctvRef =
      evt.cctvTimestampRef || `CAM-GATE-01_${evt.timestamp.toISOString().replace(/[:.]/g, '-')}`;
    const snapshot = generateSyntheticCctvSnapshot({
      cctvRef,
      deviceCode: evt.device.deviceCode,
      direction: 'EXIT',
      tagEpc: evt.tagEpc,
      accessionNumber: evt.bookItem?.accessionNumber ?? null,
      alarmTriggered: evt.alarmTriggered,
      footfallCount: evt.footfallCount ?? 1,
      timestampIso: evt.timestamp.toISOString(),
    });

    return {
      gateEventId: evt.id,
      deviceCode: evt.device.deviceCode,
      tagEpc: evt.tagEpc,
      accessionNumber: evt.bookItem?.accessionNumber ?? null,
      bookTitle: evt.bookItem?.book.title ?? null,
      alarmTriggered: evt.alarmTriggered,
      footfallCount: evt.footfallCount,
      cctvImageAttachment: snapshot,
    };
  }

  async recordFootfallEvent(
    input: {
      deviceId?: string;
      deviceCode?: string;
      direction: 'ENTRY' | 'EXIT';
      count?: number;
      patronCardUid?: string;
    },
    actor?: { userId: string; email: string }
  ) {
    const direction = String(input.direction || 'ENTRY').toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY';
    const count = Math.max(1, Number(input.count || 1));

    let device = null;
    if (input.deviceId) {
      device = await prisma.rFIDDevice.findUnique({ where: { id: input.deviceId } });
    } else if (input.deviceCode) {
      device = await prisma.rFIDDevice.findUnique({ where: { deviceCode: input.deviceCode } });
    }
    if (!device) {
      device = await prisma.rFIDDevice.findFirst({ where: { deviceType: 'SECURITY_GATE' } });
    }
    if (!device) {
      device = await prisma.rFIDDevice.findFirst();
    }
    if (!device) {
      throw new AppError('No RFID security gate device registered for footfall logging', 404);
    }

    const cctvRef = `CAM-FOOTFALL-01_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const evt = await prisma.deviceEvent.create({
      data: {
        deviceId: device.id,
        eventType: direction === 'ENTRY' ? 'FOOTFALL_ENTRY' : 'FOOTFALL_EXIT',
        payload: {
          direction,
          count,
          patronCardUid: input.patronCardUid || null,
          cctvTimestampRef: cctvRef,
          recordedBy: actor?.email || 'gate-sensor@smartlib.local',
        },
      },
    });

    return {
      id: evt.id,
      deviceId: device.id,
      deviceCode: device.deviceCode,
      eventType: evt.eventType,
      direction,
      count,
      cctvTimestampRef: cctvRef,
      timestamp: evt.timestamp,
      hardwareMode: env.MOCK_RFID_MODE ? 'MOCK_EMULATOR' : 'HARDWARE_LIVE',
    };
  }

  async getFootfallSummary() {
    const events = await prisma.deviceEvent.findMany({
      where: {
        eventType: { in: ['FOOTFALL_ENTRY', 'FOOTFALL_EXIT'] },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: {
        device: { select: { deviceCode: true, name: true, location: true } },
      },
    });

    let totalEntries = 0;
    let totalExits = 0;
    for (const e of events) {
      const p = (e.payload as Record<string, unknown>) || {};
      const c = Number(p.count || p.footfallCount || 1);
      if (e.eventType === 'FOOTFALL_ENTRY') totalEntries += c;
      if (e.eventType === 'FOOTFALL_EXIT') totalExits += c;
    }

    return {
      totalEntries,
      totalExits,
      totalFootfallEvents: events.length,
      recentEvents: events.slice(0, 25),
    };
  }

  async reconcileInventorySession(
    input: InventorySessionInput,
    actor: { userId: string; email: string; ipAddress?: string }
  ) {
    const targetLocation = input.targetLocation?.trim();
    if (!targetLocation) {
      throw new AppError('targetLocation is required for an RFID inventory session', 400);
    }

    const rawEpcs = Array.isArray(input.scannedEpcs) ? input.scannedEpcs : [];
    const normalizedAll = rawEpcs
      .map((e) => e?.trim().toUpperCase())
      .filter((e): e is string => Boolean(e));

    const uniqueEpcs = Array.from(new Set(normalizedAll));
    const duplicateScanCount = normalizedAll.length - uniqueEpcs.length;

    let device = null;
    if (input.deviceId) {
      device = await prisma.rFIDDevice.findUnique({ where: { id: input.deviceId } });
    } else if (input.deviceCode) {
      device = await prisma.rFIDDevice.findUnique({ where: { deviceCode: input.deviceCode } });
    }
    if (!device) {
      device = await prisma.rFIDDevice.findFirst({ where: { deviceType: 'HANDHELD_READER' } });
    }

    // 1. Query all copies expected at targetLocation
    const expectedCopies = await prisma.bookItem.findMany({
      where: {
        shelfLocation: targetLocation,
        deletedAt: null,
      },
      include: {
        rfidTag: true,
        book: { select: { id: true, title: true } },
      },
    });

    // 2. Query all RFID tags matching uniqueEpcs
    const matchedTags = uniqueEpcs.length
      ? await prisma.rFIDTag.findMany({
          where: { epc: { in: uniqueEpcs } },
          include: {
            bookItem: {
              include: { book: { select: { id: true, title: true } } },
            },
          },
        })
      : [];

    const tagByEpc = new Map(matchedTags.map((t) => [t.epc, t]));

    const scanRecordsToCreate: Array<{
      bookItemId: string | null;
      scannedEpc: string;
      expectedShelfLocation: string | null;
      scannedShelfLocation: string;
      scanStatus: InventoryScanStatus;
    }> = [];

    let totalVerified = 0;
    let totalMisplaced = 0;
    let totalUncataloged = 0;
    const scannedBookItemIds = new Set<string>();

    for (const epc of uniqueEpcs) {
      const tag = tagByEpc.get(epc);
      if (!tag || !tag.bookItem) {
        totalUncataloged++;
        scanRecordsToCreate.push({
          bookItemId: null,
          scannedEpc: epc,
          expectedShelfLocation: null,
          scannedShelfLocation: targetLocation,
          scanStatus: 'UNCATALOGED',
        });
        continue;
      }

      const item = tag.bookItem;
      scannedBookItemIds.add(item.id);

      if (item.shelfLocation === targetLocation) {
        totalVerified++;
        scanRecordsToCreate.push({
          bookItemId: item.id,
          scannedEpc: epc,
          expectedShelfLocation: item.shelfLocation,
          scannedShelfLocation: targetLocation,
          scanStatus: 'VERIFIED',
        });
      } else {
        totalMisplaced++;
        scanRecordsToCreate.push({
          bookItemId: item.id,
          scannedEpc: epc,
          expectedShelfLocation: item.shelfLocation,
          scannedShelfLocation: targetLocation,
          scanStatus: 'MISPLACED',
        });
      }
    }

    // 3. Identify MISSING copies expected on this shelf (AVAILABLE or REFERENCE_ONLY, not currently ISSUED)
    let totalMissing = 0;
    for (const expectedItem of expectedCopies) {
      if (expectedItem.status === 'ISSUED') {
        continue;
      }
      if (!scannedBookItemIds.has(expectedItem.id)) {
        totalMissing++;
        scanRecordsToCreate.push({
          bookItemId: expectedItem.id,
          scannedEpc: expectedItem.rfidTag?.epc || `UNTAGGED-${expectedItem.accessionNumber}`,
          expectedShelfLocation: expectedItem.shelfLocation,
          scannedShelfLocation: targetLocation,
          scanStatus: 'MISSING',
        });
      }
    }

    const sessionCode = `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const session = await prisma.$transaction(async (tx) => {
      const createdSession = await tx.inventorySession.create({
        data: {
          sessionCode,
          conductedByUserId: actor.userId,
          deviceId: device?.id ?? null,
          targetLocation,
          startedAt: new Date(),
          completedAt: new Date(),
          totalScanned: uniqueEpcs.length,
          totalVerified,
          totalMisplaced,
          totalMissing,
          status: 'COMPLETED',
          scans: {
            create: scanRecordsToCreate,
          },
        },
        include: {
          scans: {
            include: {
              bookItem: {
                select: {
                  id: true,
                  accessionNumber: true,
                  shelfLocation: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: 'CREATE',
          entityName: 'InventorySession',
          entityId: createdSession.id,
          newState: {
            sessionCode: createdSession.sessionCode,
            targetLocation,
            rawScanCount: normalizedAll.length,
            uniqueScannedCount: uniqueEpcs.length,
            duplicateScanCount,
            totalVerified,
            totalMisplaced,
            totalMissing,
            totalUncataloged,
          },
          ipAddress: actor.ipAddress ?? null,
        },
      });

      return createdSession;
    });

    const hasAnomalies = totalMisplaced + totalMissing + totalUncataloged > 0;
    const handheldConfirmation = {
      visibleIndicator: hasAnomalies ? 'AMBER_LED_BLINK' : 'GREEN_LED_SOLID',
      audibleAlert: hasAnomalies ? 'DOUBLE_BEEP_800HZ_ATTENTION' : 'SINGLE_BEEP_2000HZ_OK',
      operatorDisplayBanner: `Sweep Complete (${targetLocation}): ${totalVerified} Verified, ${totalMisplaced} Misplaced, ${totalMissing} Missing, ${totalUncataloged} Uncataloged (${duplicateScanCount} Duplicates Filtered)`,
    };

    const enrichedScans = session.scans.map((s) => ({
      ...s,
      accessionNumber: s.bookItem?.accessionNumber ?? null,
      handheldFeedback: {
        visibleIndicator:
          s.scanStatus === 'VERIFIED'
            ? 'GREEN_LED_FLASH'
            : s.scanStatus === 'MISPLACED'
              ? 'AMBER_LED_BLINK'
              : s.scanStatus === 'UNCATALOGED'
                ? 'RED_LED_PULSE'
                : 'SLATE_MISSING_ALERT',
        audibleAlert:
          s.scanStatus === 'VERIFIED'
            ? 'SINGLE_BEEP_2KHZ'
            : s.scanStatus === 'MISPLACED'
              ? 'DOUBLE_WARN_BEEP_800HZ'
              : s.scanStatus === 'UNCATALOGED'
                ? 'TRIPLE_ALERT_CHIME'
                : 'MISSING_RECORD_FLAG',
      },
    }));

    return {
      ...session,
      scans: enrichedScans,
      handheldConfirmation,
      summary: {
        rawScanCount: normalizedAll.length,
        uniqueScannedCount: uniqueEpcs.length,
        duplicateScanCount,
        totalVerified,
        totalMisplaced,
        totalMissing,
        totalUncataloged,
      },
      hardwareMode: env.MOCK_RFID_MODE ? 'MOCK_EMULATOR' : 'HARDWARE_LIVE',
    };
  }
}

export const rfidService = new RFIDService();
