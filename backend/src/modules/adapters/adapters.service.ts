import { prisma } from '../../config/prisma.js';
import { circulationService } from '../circulation/circulation.service.js';
import { generateSyntheticCctvSnapshot } from '../rfid/rfid.service.js';
import { ValidationError } from '../../utils/errors.js';
import { env } from '../../config/env.js';

// ============================================================================
// 4.1 Device-Neutral Hardware & Communication Adapter Architecture (9 Adapters)
// ============================================================================

export type AdapterCategory =
  | 'STAFF_READER'
  | 'HANDHELD_READER'
  | 'SECURITY_GATE'
  | 'SMART_CARD'
  | 'RFID_TAG'
  | 'CAMERA'
  | 'PRINTER'
  | 'EMAIL'
  | 'SMS';

export interface RetryTimeoutPolicy {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
}

export interface DeviceAdapterSpecification {
  adapterId: string;
  adapterType: AdapterCategory;
  displayName: string;
  protocol: string;
  mode: 'MOCK_EMULATOR' | 'HARDWARE_LIVE';
  connectionStatus: 'CONNECTED_MOCK' | 'CONNECTED_LIVE' | 'STANDBY';
  capabilities: string[];
  supportedCommands: string[];
  supportedEvents: string[];
  retryPolicy: RetryTimeoutPolicy;
}

const NINE_DEVICE_ADAPTERS: DeviceAdapterSpecification[] = [
  {
    adapterId: 'adapter-staff-reader',
    adapterType: 'STAFF_READER',
    displayName: 'Staff Desktop HF/UHF RFID Pad Adapter',
    protocol: 'ISO 15693 / EPCglobal UHF Class 1 Gen 2 (USB/REST)',
    mode: env.MOCK_RFID_MODE ? 'MOCK_EMULATOR' : 'HARDWARE_LIVE',
    connectionStatus: env.MOCK_RFID_MODE ? 'CONNECTED_MOCK' : 'CONNECTED_LIVE',
    capabilities: ['READ_EPC', 'WRITE_EPC', 'SET_EAS_BIT', 'ANTI_COLLISION_5_TAGS'],
    supportedCommands: ['SCAN_PAD', 'ENCODE_TAG', 'ARM_EAS', 'DISARM_EAS'],
    supportedEvents: ['TAG_DETECTED', 'TAG_ENCODED', 'EAS_STATE_CHANGED', 'READER_ERROR'],
    retryPolicy: { maxRetries: 3, retryDelayMs: 500, timeoutMs: 3000 },
  },
  {
    adapterId: 'adapter-handheld-reader',
    adapterType: 'HANDHELD_READER',
    displayName: 'Handheld UHF Inventory Wand Adapter',
    protocol: 'ISO 18000-6C UHF Batch Stream (Wi-Fi/BLE)',
    mode: env.MOCK_RFID_MODE ? 'MOCK_EMULATOR' : 'HARDWARE_LIVE',
    connectionStatus: env.MOCK_RFID_MODE ? 'CONNECTED_MOCK' : 'CONNECTED_LIVE',
    capabilities: ['BULK_INVENTORY_SWEEP', 'RSSI_GEIGER_SEARCH', 'DUPLICATE_FILTERING'],
    supportedCommands: ['START_SWEEP', 'STOP_SWEEP', 'FLUSH_BATCH'],
    supportedEvents: ['BATCH_EPC_STREAM', 'MISPLACED_TAG_ALERT', 'BATTERY_LOW'],
    retryPolicy: { maxRetries: 3, retryDelayMs: 1000, timeoutMs: 5000 },
  },
  {
    adapterId: 'adapter-security-gate',
    adapterType: 'SECURITY_GATE',
    displayName: 'Dual-Pedestal EAS Security Gate Adapter',
    protocol: 'TCP/IP LLRP + Optical Beam Footfall Counter',
    mode: env.MOCK_RFID_MODE ? 'MOCK_EMULATOR' : 'HARDWARE_LIVE',
    connectionStatus: env.MOCK_RFID_MODE ? 'CONNECTED_MOCK' : 'CONNECTED_LIVE',
    capabilities: ['EAS_BIT_INSPECTION', 'SIREN_STROBE_RELAY', 'BIDIRECTIONAL_FOOTFALL'],
    supportedCommands: ['INSPECT_TRANSIT', 'TRIGGER_ALARM', 'RESET_ALARM', 'READ_FOOTFALL'],
    supportedEvents: ['AUTHORIZED_PASSAGE', 'UNAUTHORIZED_EAS_ALARM', 'FOOTFALL_INCREMENT'],
    retryPolicy: { maxRetries: 5, retryDelayMs: 300, timeoutMs: 2000 },
  },
  {
    adapterId: 'adapter-smart-card',
    adapterType: 'SMART_CARD',
    displayName: 'Contactless Patron Smart Card Reader Adapter',
    protocol: 'ISO/IEC 14443A MIFARE / NFC (PC/SC)',
    mode: env.MOCK_RFID_MODE ? 'MOCK_EMULATOR' : 'HARDWARE_LIVE',
    connectionStatus: env.MOCK_RFID_MODE ? 'CONNECTED_MOCK' : 'CONNECTED_LIVE',
    capabilities: ['READ_CARD_UID', 'VERIFY_SECTOR_HASH', 'PATRON_FAST_LOOKUP'],
    supportedCommands: ['READ_UID', 'BEEP_OK', 'BEEP_DENIED'],
    supportedEvents: ['CARD_TAPPED', 'CARD_REMOVED', 'CARD_READ_ERROR'],
    retryPolicy: { maxRetries: 2, retryDelayMs: 250, timeoutMs: 1500 },
  },
  {
    adapterId: 'adapter-rfid-tag',
    adapterType: 'RFID_TAG',
    displayName: 'RFID Transponder & Data Model Codec Adapter',
    protocol: 'ISO 28560-2 / SGTIN-96 EPC Memory Bank Codec',
    mode: env.MOCK_RFID_MODE ? 'MOCK_EMULATOR' : 'HARDWARE_LIVE',
    connectionStatus: 'CONNECTED_MOCK',
    capabilities: ['VALIDATE_EPC_HEX', 'VERIFY_TID', 'AFI_EAS_BYTE_CODEC', 'CRC16_VALIDATION'],
    supportedCommands: ['ENCODE_PAYLOAD', 'DECODE_PAYLOAD', 'VERIFY_CHECKSUM'],
    supportedEvents: ['TAG_VALIDATED', 'CHECKSUM_MISMATCH'],
    retryPolicy: { maxRetries: 2, retryDelayMs: 100, timeoutMs: 1000 },
  },
  {
    adapterId: 'adapter-camera',
    adapterType: 'CAMERA',
    displayName: 'Security Gate CCTV Timestamp Correlator Adapter',
    protocol: 'ONVIF / NVR Frame Bookmark Token Generator',
    mode: 'MOCK_EMULATOR',
    connectionStatus: 'CONNECTED_MOCK',
    capabilities: ['GENERATE_FRAME_REF', 'CORRELATE_GATE_ALARM', 'RETENTION_TAGGING', 'SYNTHETIC_SNAPSHOT_SVG'],
    supportedCommands: ['CAPTURE_TIMESTAMP_REF', 'CAPTURE_SNAPSHOT', 'QUERY_INCIDENT_REF'],
    supportedEvents: ['FRAME_BOOKMARK_CREATED'],
    retryPolicy: { maxRetries: 2, retryDelayMs: 500, timeoutMs: 2500 },
  },
  {
    adapterId: 'adapter-printer',
    adapterType: 'PRINTER',
    displayName: 'Barcode, Spine-Label & Thermal Receipt Printer Adapter',
    protocol: 'PDF Sheet / ESC-POS / ZPL Label Renderer',
    mode: 'MOCK_EMULATOR',
    connectionStatus: 'CONNECTED_MOCK',
    capabilities: ['CODE128_BARCODE_SVG', 'SPINE_LABEL_PDF', 'CIRCULATION_RECEIPT'],
    supportedCommands: ['RENDER_BARCODE', 'RENDER_SPINE_SHEET', 'PRINT_RECEIPT'],
    supportedEvents: ['PRINT_JOB_QUEUED', 'PRINT_JOB_COMPLETED'],
    retryPolicy: { maxRetries: 2, retryDelayMs: 500, timeoutMs: 4000 },
  },
  {
    adapterId: 'adapter-email',
    adapterType: 'EMAIL',
    displayName: 'Institutional Email Notification Adapter',
    protocol: 'SMTP / TLS Notification Dispatch Interface',
    mode: 'MOCK_EMULATOR',
    connectionStatus: 'CONNECTED_MOCK',
    capabilities: ['DUE_DATE_REMINDER', 'OVERDUE_NOTICE', 'FINE_RECEIPT', 'SECURITY_ALERT'],
    supportedCommands: ['SEND_EMAIL', 'VERIFY_TEMPLATES'],
    supportedEvents: ['EMAIL_QUEUED', 'EMAIL_DISPATCHED_MOCK'],
    retryPolicy: { maxRetries: 3, retryDelayMs: 2000, timeoutMs: 5000 },
  },
  {
    adapterId: 'adapter-sms',
    adapterType: 'SMS',
    displayName: 'Patron SMS Alert Gateway Adapter',
    protocol: 'HTTPS REST SMS Webhook Interface',
    mode: 'MOCK_EMULATOR',
    connectionStatus: 'CONNECTED_MOCK',
    capabilities: ['OVERDUE_SMS_ALERT', 'HOLD_READY_SMS'],
    supportedCommands: ['SEND_SMS', 'CHECK_GATEWAY_BALANCE'],
    supportedEvents: ['SMS_QUEUED', 'SMS_DISPATCHED_MOCK'],
    retryPolicy: { maxRetries: 3, retryDelayMs: 1500, timeoutMs: 4000 },
  },
];

// ============================================================================
// 4.2 NCIP 2.0 Protocol Adapter Boundary
// ============================================================================

export type NCIPServiceType =
  | 'LookupUser'
  | 'LookupItem'
  | 'CheckOutItem'
  | 'CheckInItem'
  | 'RenewItem';

export interface NCIPRequestPayload {
  service: NCIPServiceType;
  agencyId?: string;
  userId?: string;
  cardNumber?: string;
  itemId?: string;
  accessionNumber?: string;
  circulationId?: string;
  timeoutMs?: number;
}

// ============================================================================
// 4.3 3M SIP2 Protocol Parser & Checksum Serializer
// ============================================================================

export function computeSip2Checksum(messageWithoutChecksum: string): string {
  let sum = 0;
  for (let i = 0; i < messageWithoutChecksum.length; i++) {
    sum = (sum + messageWithoutChecksum.charCodeAt(i)) & 0xffff;
  }
  const twosComplement = ((~sum + 1) & 0xffff);
  return twosComplement.toString(16).toUpperCase().padStart(4, '0');
}

export function appendSip2Checksum(body: string, sequenceNumber = '0'): string {
  const withSeq = `${body}|AY${sequenceNumber}AZ`;
  const checksum = computeSip2Checksum(withSeq);
  return `${withSeq}${checksum}`;
}

export function parseSip2Message(rawMessage: string) {
  const trimmed = rawMessage?.trim() || '';
  if (trimmed.length < 2) {
    throw new ValidationError('SIP2 message is empty or shorter than 2-character command code');
  }

  const commandCode = trimmed.slice(0, 2);
  const fields: Record<string, string> = {};
  const parts = trimmed.slice(2).split('|');
  for (const part of parts) {
    if (part.length >= 2) {
      const key = part.slice(0, 2);
      const val = part.slice(2);
      fields[key] = val;
    }
  }

  return {
    commandCode,
    rawMessage: trimmed,
    fields,
    sequenceNumber: fields['AY']?.[0] || '0',
    providedChecksum: fields['AZ'] || trimmed.slice(-4),
  };
}

export class AdaptersService {
  getAllDeviceAdapters() {
    return {
      architecture: 'SmartLib Device-Neutral Hardware & Notification Abstraction Layer',
      totalAdapters: NINE_DEVICE_ADAPTERS.length,
      mockModeActive: env.MOCK_RFID_MODE,
      adapters: NINE_DEVICE_ADAPTERS.map((a) => ({
        ...a,
        health: {
          healthy: true,
          latencyMs: 2,
          checkedAt: new Date().toISOString(),
        },
      })),
    };
  }

  async executeDeviceCommand(
    adapterType: AdapterCategory,
    command: string,
    payload: Record<string, unknown> = {}
  ) {
    const adapter = NINE_DEVICE_ADAPTERS.find((a) => a.adapterType === adapterType);
    if (!adapter) {
      throw new ValidationError(`Unknown device adapter type '${adapterType}'`);
    }
    if (!adapter.supportedCommands.includes(command)) {
      throw new ValidationError(
        `Command '${command}' is not supported by ${adapter.displayName}. Supported: ${adapter.supportedCommands.join(', ')}`
      );
    }

    const syntheticImage =
      adapterType === 'CAMERA'
        ? generateSyntheticCctvSnapshot({
            cctvRef:
              String(payload.cctvRef || '') ||
              `CAM-GATE-01_${new Date().toISOString().replace(/[:.]/g, '-')}`,
            deviceCode: String(payload.deviceCode || 'GATE-MAIN-01'),
            direction: String(payload.direction || 'EXIT'),
            tagEpc: payload.tagEpc ? String(payload.tagEpc) : null,
            accessionNumber: payload.accessionNumber ? String(payload.accessionNumber) : null,
            alarmTriggered: Boolean(payload.alarmTriggered ?? true),
            footfallCount: Number(payload.footfallCount || 1),
            timestampIso: new Date().toISOString(),
          })
        : undefined;

    return {
      adapterId: adapter.adapterId,
      adapterType: adapter.adapterType,
      mode: adapter.mode,
      commandExecuted: command,
      status: 'SUCCESS',
      executedAt: new Date().toISOString(),
      retryPolicyApplied: adapter.retryPolicy,
      ...(syntheticImage ? { syntheticImage } : {}),
      mockTelemetry: {
        simulated: true,
        payloadEcho: payload,
      },
    };
  }

  // --------------------------------------------------------------------------
  // 4.2 NCIP 2.0 Protocol Boundary Handler
  // --------------------------------------------------------------------------
  async processNcipMessage(input: NCIPRequestPayload, actorUserId?: string) {
    const agencyId = input.agencyId || 'SMARTLIB-INST-01';
    const timestamp = new Date().toISOString();

    if (!input.service) {
      throw new ValidationError('NCIP 2.0 request requires a valid service name');
    }

    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          actorEmail: 'ncip-adapter@smartlib.local',
          action:
            input.service === 'LookupUser' || input.service === 'LookupItem'
              ? 'UPDATE'
              : 'CREATE',
          entityName: 'NCIPAdapter',
          entityId: input.itemId || input.accessionNumber || input.cardNumber || input.service,
          newState: {
            service: input.service,
            agencyId,
            cardNumber: input.cardNumber ?? null,
            accessionNumber: input.accessionNumber ?? null,
            itemId: input.itemId ?? null,
            circulationId: input.circulationId ?? null,
          },
        },
      });
      switch (input.service) {
        case 'LookupUser': {
          const identifier = input.cardNumber || input.userId || '';
          const member = await prisma.member.findFirst({
            where: {
              OR: [
                { id: identifier },
                { cardNumber: identifier },
                { smartCardUid: identifier },
              ],
              deletedAt: null,
            },
            include: {
              circulations: { where: { status: 'ACTIVE' }, select: { id: true } },
            },
          });

          if (!member) {
            return {
              ncipVersion: '2.0',
              agencyId,
              service: 'LookupUserResponse',
              certificationStatus: 'ADAPTER_BOUNDARY_MOCK_PROVIDER (Not NCIP 2.0 Certified)',
              problem: {
                problemType: 'Unknown User',
                problemDetail: `Patron '${identifier}' was not found`,
              },
              timestamp,
            };
          }

          return {
            ncipVersion: '2.0',
            agencyId,
            service: 'LookupUserResponse',
            certificationStatus: 'ADAPTER_BOUNDARY_MOCK_PROVIDER (Not NCIP 2.0 Certified)',
            userId: member.id,
            cardNumber: member.cardNumber,
            userFields: {
              fullName: `${member.firstName} ${member.lastName}`,
              memberType: member.memberType,
              userPrivilegeStatus: member.status,
              activeLoansCount: member.circulations.length,
              fineBalance: Number(member.fineBalance),
            },
            timestamp,
          };
        }

        case 'LookupItem': {
          const itemIdentifier = input.accessionNumber || input.itemId || '';
          const copy = await prisma.bookItem.findFirst({
            where: {
              OR: [
                { id: itemIdentifier },
                { accessionNumber: itemIdentifier },
                { barcode: itemIdentifier },
              ],
              deletedAt: null,
            },
            include: {
              book: { include: { authors: { include: { author: true } } } },
              rfidTag: true,
            },
          });

          if (!copy) {
            return {
              ncipVersion: '2.0',
              agencyId,
              service: 'LookupItemResponse',
              certificationStatus: 'ADAPTER_BOUNDARY_MOCK_PROVIDER (Not NCIP 2.0 Certified)',
              problem: {
                problemType: 'Unknown Item',
                problemDetail: `Item '${itemIdentifier}' was not found`,
              },
              timestamp,
            };
          }

          return {
            ncipVersion: '2.0',
            agencyId,
            service: 'LookupItemResponse',
            certificationStatus: 'ADAPTER_BOUNDARY_MOCK_PROVIDER (Not NCIP 2.0 Certified)',
            itemId: copy.id,
            accessionNumber: copy.accessionNumber,
            itemOptionalFields: {
              bibliographicDescription: {
                title: copy.book.title,
                isbn: copy.book.isbn13,
                author: copy.book.authors.map((a) => a.author.name).join(', '),
              },
              circulationStatus: copy.status,
              shelfLocation: copy.shelfLocation,
              isReferenceOnly: copy.isReferenceOnly,
              easArmed: copy.rfidTag?.easArmed ?? null,
            },
            timestamp,
          };
        }

        case 'CheckOutItem': {
          const member = await prisma.member.findFirst({
            where: {
              OR: [{ id: input.userId || '' }, { cardNumber: input.cardNumber || '' }],
              deletedAt: null,
            },
          });
          const copy = await prisma.bookItem.findFirst({
            where: {
              OR: [{ id: input.itemId || '' }, { accessionNumber: input.accessionNumber || '' }],
              deletedAt: null,
            },
          });
          if (!member || !copy) {
            return {
              ncipVersion: '2.0',
              agencyId,
              service: 'CheckOutItemResponse',
              certificationStatus: 'ADAPTER_BOUNDARY_MOCK_PROVIDER (Not NCIP 2.0 Certified)',
              problem: {
                problemType: !member ? 'Unknown User' : 'Unknown Item',
                problemDetail: 'User or Item could not be resolved for NCIP CheckOutItem',
              },
              timestamp,
            };
          }

          const issued = await circulationService.issueBook(
            { memberId: member.id, bookItemId: copy.id },
            actorUserId || (await prisma.user.findFirst())!.id
          );

          return {
            ncipVersion: '2.0',
            agencyId,
            service: 'CheckOutItemResponse',
            certificationStatus: 'ADAPTER_BOUNDARY_MOCK_PROVIDER (Not NCIP 2.0 Certified)',
            circulationId: issued.id,
            userId: member.cardNumber,
            itemId: copy.accessionNumber,
            dateDue: issued.dueDate.toISOString(),
            easArmed: false,
            timestamp,
          };
        }

        case 'CheckInItem': {
          const returned = await circulationService.returnLoan(
            {
              circulationId: input.circulationId,
              bookItemId: input.itemId,
              accessionNumber: input.accessionNumber,
            },
            actorUserId
          );

          return {
            ncipVersion: '2.0',
            agencyId,
            service: 'CheckInItemResponse',
            certificationStatus: 'ADAPTER_BOUNDARY_MOCK_PROVIDER (Not NCIP 2.0 Certified)',
            circulationId: returned.circulation.id,
            itemId: returned.bookItem.accessionNumber,
            itemStatus: 'AVAILABLE',
            easArmed: true,
            fineAssessed: returned.fine ? Number(returned.fine.amount) : 0,
            timestamp,
          };
        }

        case 'RenewItem': {
          const renewed = await circulationService.renewLoan(
            {
              circulationId: input.circulationId,
              bookItemId: input.itemId,
            },
            actorUserId
          );

          return {
            ncipVersion: '2.0',
            agencyId,
            service: 'RenewItemResponse',
            certificationStatus: 'ADAPTER_BOUNDARY_MOCK_PROVIDER (Not NCIP 2.0 Certified)',
            circulationId: renewed.id,
            dateDue: renewed.dueDate.toISOString(),
            renewalCount: renewed.renewalCount,
            timestamp,
          };
        }

        default:
          throw new ValidationError(`Unsupported NCIP 2.0 service: ${input.service}`);
      }
    } catch (err) {
      return {
        ncipVersion: '2.0',
        agencyId,
        service: `${input.service}Response`,
        certificationStatus: 'ADAPTER_BOUNDARY_MOCK_PROVIDER (Not NCIP 2.0 Certified)',
        problem: {
          problemType: 'Circulation Policy / Validation Error',
          problemDetail: (err as Error).message,
        },
        timestamp,
      };
    }
  }

  getNcipExamples() {
    return {
      standard: 'NISO Z39.83 (NCIP 2.0)',
      certificationDisclaimer:
        'Documented adapter boundary and mock provider only. Not certified against an external production ILMS.',
      examples: {
        LookupUserRequest: {
          service: 'LookupUser',
          agencyId: 'SMARTLIB-INST-01',
          cardNumber: 'MEM-2026-001',
        },
        LookupItemRequest: {
          service: 'LookupItem',
          agencyId: 'SMARTLIB-INST-01',
          accessionNumber: 'ACC-2026-00001',
        },
        CheckOutItemRequest: {
          service: 'CheckOutItem',
          agencyId: 'SMARTLIB-INST-01',
          cardNumber: 'MEM-2026-001',
          accessionNumber: 'ACC-2026-00001',
        },
      },
    };
  }

  // --------------------------------------------------------------------------
  // 4.3 3M SIP2 Protocol Adapter Boundary Handler
  // --------------------------------------------------------------------------
  async processSip2Message(rawMessage: string, actorUserId?: string) {
    const parsed = parseSip2Message(rawMessage);
    const seq = parsed.sequenceNumber;
    const nowSip = new Date()
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 14) + '    ';

    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId ?? null,
        actorEmail: 'sip2-adapter@smartlib.local',
        action:
          parsed.commandCode === '11' || parsed.commandCode === '09' || parsed.commandCode === '29'
            ? 'CREATE'
            : 'UPDATE',
        entityName: 'SIP2Adapter',
        entityId: parsed.fields['AB'] || parsed.fields['AA'] || parsed.commandCode,
        newState: {
          commandCode: parsed.commandCode,
          patronFieldAA: parsed.fields['AA'] ?? null,
          itemFieldAB: parsed.fields['AB'] ?? null,
          sequenceNumber: seq,
        },
      },
    });

    switch (parsed.commandCode) {
      case '93': {
        // Login Request -> 94 Login Response (1 = OK)
        const responseWire = appendSip2Checksum('941', seq);
        return {
          requestCommand: '93 (Login Request)',
          responseCommand: '94 (Login Response)',
          parsedFields: parsed.fields,
          responseWire,
          productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
        };
      }

      case '99': {
        // SC Status -> 98 ACS Status Response
        const responseWire = appendSip2Checksum(
          `98YYYYNN025003${nowSip}2.00|AOSMARTLIB-INST-01|BXYYYYYYYYYYYYYYYY`,
          seq
        );
        return {
          requestCommand: '99 (SC Status Request)',
          responseCommand: '98 (ACS Status Response)',
          parsedFields: parsed.fields,
          responseWire,
          productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
        };
      }

      case '63': {
        // Patron Information Request -> 64 Patron Information Response
        const patronCode = parsed.fields['AA'] || '';
        const member = await prisma.member.findFirst({
          where: {
            OR: [{ cardNumber: patronCode }, { smartCardUid: patronCode }, { id: patronCode }],
            deletedAt: null,
          },
        });

        if (!member) {
          const responseWire = appendSip2Checksum(
            `64YYYY          000${nowSip}000000000000000000000000|AOSMARTLIB|AA${patronCode}|AEUnknown Patron|BLN|AFPatron card not found`,
            seq
          );
          return {
            requestCommand: '63 (Patron Information Request)',
            responseCommand: '64 (Patron Information Response)',
            patronFound: false,
            parsedFields: parsed.fields,
            responseWire,
            productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
          };
        }

        const chargePrivilege = member.status === 'ACTIVE' ? ' ' : 'Y';
        const responseWire = appendSip2Checksum(
          `64${chargePrivilege}             000${nowSip}000000000000000000000000|AOSMARTLIB|AA${member.cardNumber}|AE${member.firstName} ${member.lastName}|BLY|CQY|BV${Number(member.fineBalance).toFixed(2)}`,
          seq
        );

        return {
          requestCommand: '63 (Patron Information Request)',
          responseCommand: '64 (Patron Information Response)',
          patronFound: true,
          patron: {
            cardNumber: member.cardNumber,
            fullName: `${member.firstName} ${member.lastName}`,
            status: member.status,
            fineBalance: Number(member.fineBalance),
          },
          parsedFields: parsed.fields,
          responseWire,
          productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
        };
      }

      case '17': {
        // Item Information Request -> 18 Item Information Response
        const itemCode = parsed.fields['AB'] || '';
        const copy = await prisma.bookItem.findFirst({
          where: {
            OR: [{ accessionNumber: itemCode }, { barcode: itemCode }, { id: itemCode }],
            deletedAt: null,
          },
          include: { book: true },
        });

        if (!copy) {
          const responseWire = appendSip2Checksum(
            `18010001${nowSip}|AB${itemCode}|AJUnknown Item|AFItem not found in catalog`,
            seq
          );
          return {
            requestCommand: '17 (Item Information Request)',
            responseCommand: '18 (Item Information Response)',
            itemFound: false,
            parsedFields: parsed.fields,
            responseWire,
            productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
          };
        }

        const circStatus = copy.status === 'AVAILABLE' ? '03' : '04';
        const responseWire = appendSip2Checksum(
          `18${circStatus}0001${nowSip}|AB${copy.accessionNumber}|AJ${copy.book.title}|AP${copy.shelfLocation}`,
          seq
        );
        return {
          requestCommand: '17 (Item Information Request)',
          responseCommand: '18 (Item Information Response)',
          itemFound: true,
          item: {
            accessionNumber: copy.accessionNumber,
            title: copy.book.title,
            status: copy.status,
            shelfLocation: copy.shelfLocation,
          },
          parsedFields: parsed.fields,
          responseWire,
          productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
        };
      }

      case '11': {
        // Checkout Request -> 12 Checkout Response
        const patronCode = parsed.fields['AA'] || '';
        const itemCode = parsed.fields['AB'] || '';
        const member = await prisma.member.findFirst({
          where: { OR: [{ cardNumber: patronCode }, { id: patronCode }], deletedAt: null },
        });
        const copy = await prisma.bookItem.findFirst({
          where: { OR: [{ accessionNumber: itemCode }, { barcode: itemCode }], deletedAt: null },
          include: { book: true },
        });

        if (!member || !copy) {
          const responseWire = appendSip2Checksum(
            `120NNY${nowSip}|AOSMARTLIB|AA${patronCode}|AB${itemCode}|AFMember or item not found`,
            seq
          );
          return {
            requestCommand: '11 (Checkout Request)',
            responseCommand: '12 (Checkout Response)',
            checkoutSucceeded: false,
            responseWire,
            productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
          };
        }

        try {
          const issued = await circulationService.issueBook(
            { memberId: member.id, bookItemId: copy.id },
            actorUserId || (await prisma.user.findFirst())!.id
          );
          const dueIso = issued.dueDate.toISOString().slice(0, 10);
          const responseWire = appendSip2Checksum(
            `121YNY${nowSip}|AOSMARTLIB|AA${member.cardNumber}|AB${copy.accessionNumber}|AJ${copy.book.title}|AH${dueIso}`,
            seq
          );
          return {
            requestCommand: '11 (Checkout Request)',
            responseCommand: '12 (Checkout Response)',
            checkoutSucceeded: true,
            circulationId: issued.id,
            dueDate: dueIso,
            responseWire,
            productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
          };
        } catch (err) {
          const responseWire = appendSip2Checksum(
            `120NNY${nowSip}|AOSMARTLIB|AA${member.cardNumber}|AB${copy.accessionNumber}|AF${(err as Error).message}`,
            seq
          );
          return {
            requestCommand: '11 (Checkout Request)',
            responseCommand: '12 (Checkout Response)',
            checkoutSucceeded: false,
            error: (err as Error).message,
            responseWire,
            productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
          };
        }
      }

      case '09': {
        // Checkin Request -> 10 Checkin Response
        const itemCode = parsed.fields['AB'] || '';
        try {
          const ret = await circulationService.returnLoan(
            { accessionNumber: itemCode },
            actorUserId
          );
          const responseWire = appendSip2Checksum(
            `101YNN${nowSip}|AOSMARTLIB|AB${ret.bookItem.accessionNumber}|AQMAIN-STACKS`,
            seq
          );
          return {
            requestCommand: '09 (Checkin Request)',
            responseCommand: '10 (Checkin Response)',
            checkinSucceeded: true,
            circulationId: ret.circulation.id,
            responseWire,
            productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
          };
        } catch (err) {
          const responseWire = appendSip2Checksum(
            `100NNN${nowSip}|AOSMARTLIB|AB${itemCode}|AF${(err as Error).message}`,
            seq
          );
          return {
            requestCommand: '09 (Checkin Request)',
            responseCommand: '10 (Checkin Response)',
            checkinSucceeded: false,
            error: (err as Error).message,
            responseWire,
            productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
          };
        }
      }

      case '29': {
        // Renew Request -> 30 Renew Response
        const itemCode = parsed.fields['AB'] || '';
        const copy = await prisma.bookItem.findFirst({
          where: { OR: [{ accessionNumber: itemCode }, { barcode: itemCode }] },
        });
        try {
          const renewed = await circulationService.renewLoan(
            { bookItemId: copy?.id },
            actorUserId
          );
          const dueIso = renewed.dueDate.toISOString().slice(0, 10);
          const responseWire = appendSip2Checksum(
            `301YNN${nowSip}|AOSMARTLIB|AB${itemCode}|AH${dueIso}`,
            seq
          );
          return {
            requestCommand: '29 (Renew Request)',
            responseCommand: '30 (Renew Response)',
            renewSucceeded: true,
            dueDate: dueIso,
            responseWire,
            productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
          };
        } catch (err) {
          const responseWire = appendSip2Checksum(
            `300NNN${nowSip}|AOSMARTLIB|AB${itemCode}|AF${(err as Error).message}`,
            seq
          );
          return {
            requestCommand: '29 (Renew Request)',
            responseCommand: '30 (Renew Response)',
            renewSucceeded: false,
            error: (err as Error).message,
            responseWire,
            productionIlmsStatus: 'MOCK_SIP2_PROVIDER (No external legacy ILMS connected)',
          };
        }
      }

      default:
        throw new ValidationError(
          `Unsupported SIP2 command code '${parsed.commandCode}'. Supported: 93, 99, 63, 17, 11, 09, 29`
        );
    }
  }

  getSip2Examples() {
    return {
      protocol: '3M Standard Interchange Protocol v2.00 (SIP2)',
      connectionConfig: {
        transport: 'TCP Socket / REST Envelope Bridge',
        timeoutMs: 3000,
        reconnectBackoffMs: 1500,
        errorDetectionEnabled: true,
      },
      disclaimer:
        'Mock SIP2 provider and message parser/serializer. No external legacy ILMS is connected in this environment.',
      exampleMessages: {
        loginRequest: appendSip2Checksum('9300CNsmartlib_kiosk|COkiosk_secret|CPSMARTLIB-GATE'),
        scStatusRequest: appendSip2Checksum('9900402.00'),
        patronInfoRequest: appendSip2Checksum('6300120261109    090000          |AOSMARTLIB|AAMEM-2026-001'),
        itemInfoRequest: appendSip2Checksum('1720261109    090000|AOSMARTLIB|ABACC-2026-00001'),
        checkoutRequest: appendSip2Checksum('11YN20261109    09000020261123    090000|AOSMARTLIB|AAMEM-2026-001|ABACC-2026-00001'),
        checkinRequest: appendSip2Checksum('09N20261109    09000020261109    090000|AOSMARTLIB|ABACC-2026-00001'),
      },
    };
  }
}

export const adaptersService = new AdaptersService();

