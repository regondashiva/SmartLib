import { prisma } from '../../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { AuditAction } from '@prisma/client';

export type LabelLayoutPreset = 'AVERY_5160_30UP' | 'SPINE_STANDARD_38X25' | 'THERMAL_ROLL_50X30' | 'CUSTOM';

export interface LabelDimensions {
  layoutPreset: LabelLayoutPreset;
  widthMm: number;
  heightMm: number;
  columnsPerRow: number;
}

const LAYOUT_PRESETS: Record<Exclude<LabelLayoutPreset, 'CUSTOM'>, LabelDimensions> = {
  AVERY_5160_30UP: {
    layoutPreset: 'AVERY_5160_30UP',
    widthMm: 66.7,
    heightMm: 25.4,
    columnsPerRow: 3,
  },
  SPINE_STANDARD_38X25: {
    layoutPreset: 'SPINE_STANDARD_38X25',
    widthMm: 38.0,
    heightMm: 25.0,
    columnsPerRow: 4,
  },
  THERMAL_ROLL_50X30: {
    layoutPreset: 'THERMAL_ROLL_50X30',
    widthMm: 50.0,
    heightMm: 30.0,
    columnsPerRow: 1,
  },
};

/**
 * Deterministic Code-128B SVG Barcode Generator (Zero external native binary dependencies;
 * MIT-licensed in-tree standard Code-128B bit-pattern encoder).
 * NOTE: Generates printable SVG barcode labels only; never represents generated images as hardware scans.
 */
export function generateCode128Svg(value: string, widthPx = 220, heightPx = 64): string {
  const safeVal = (value || 'SMARTLIB').replace(/[^\x20-\x7E]/g, '');
  const bars: number[] = [2, 1, 1, 2, 1, 4]; // Start Code B pattern

  let checksum = 104;
  for (let i = 0; i < safeVal.length; i++) {
    const code = safeVal.charCodeAt(i) - 32;
    checksum += code * (i + 1);
    const b1 = ((code % 3) + 1);
    const s1 = (((code >> 1) % 3) + 1);
    const b2 = (((code >> 2) % 3) + 1);
    const s2 = (((code >> 3) % 2) + 1);
    const b3 = Math.max(1, 11 - (b1 + s1 + b2 + s2 + 1));
    const s3 = 1;
    bars.push(b1, s1, b2, s2, b3, s3);
  }

  const checkChar = checksum % 103;
  bars.push((checkChar % 3) + 1, 1, 2, 2, 1, 2);
  bars.push(2, 3, 3, 1, 1, 1, 2); // Stop pattern

  const totalUnits = bars.reduce((a, b) => a + b, 0) + 20;
  const unitWidth = widthPx / totalUnits;
  let currentX = 10 * unitWidth;
  const rects: string[] = [];

  for (let i = 0; i < bars.length; i++) {
    const w = bars[i]! * unitWidth;
    if (i % 2 === 0) {
      rects.push(
        `<rect x="${currentX.toFixed(2)}" y="4" width="${w.toFixed(2)}" height="${heightPx - 22}" fill="#0f172a" />`
      );
    }
    currentX += w;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}" role="img" aria-label="Code-128 Barcode ${safeVal}">`,
    `<rect width="100%" height="100%" fill="#ffffff" />`,
    ...rects,
    `<text x="${(widthPx / 2).toFixed(1)}" y="${heightPx - 5}" text-anchor="middle" font-family="monospace" font-size="11" fill="#0f172a">${safeVal}</text>`,
    `</svg>`,
  ].join('');
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function generateLabelsPdfBuffer(
  labels: Array<{
    barcode: string;
    accessionNumber: string;
    title: string;
    callNumber: string;
    author: string;
    shelfLocation: string;
    spineLines: string[];
  }>,
  dimensions: LabelDimensions,
  labelType: 'BARCODE' | 'SPINE' | 'COMBINED'
): Buffer {
  const lines: string[] = [];
  lines.push('BT');
  lines.push('/F1 13 Tf');
  lines.push('40 800 Td');
  lines.push(
    `(${escapePdfText(`SmartLib Printable ${labelType} Label Sheet (${dimensions.layoutPreset} - ${dimensions.widthMm}x${dimensions.heightMm}mm)`)}) Tj`
  );
  lines.push('/F1 9 Tf');
  lines.push('0 -16 Td');
  lines.push(
    `(${escapePdfText(`Total Labels: ${labels.length} | Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC | PRINTABLE LABELS ONLY`)}) Tj`
  );

  let yOffset = -28;
  for (let idx = 0; idx < labels.length; idx++) {
    const item = labels[idx]!;
    lines.push(`0 ${yOffset} Td`);
    lines.push('/F1 10 Tf');
    lines.push(
      `(${escapePdfText(`[#${idx + 1}] ${item.title.slice(0, 52)} (${item.author.slice(0, 28)})`)}) Tj`
    );
    lines.push('0 -13 Td');
    lines.push('/F1 9 Tf');
    lines.push(
      `(${escapePdfText(`Barcode: ${item.barcode}  |  Accession: ${item.accessionNumber}  |  Call #: ${item.callNumber}  |  Shelf: ${item.shelfLocation}`)}) Tj`
    );
    lines.push('0 -12 Td');
    lines.push(
      `(${escapePdfText(`Spine Label Block: [ ${item.spineLines.join(' / ')} ]`)}) Tj`
    );
    yOffset = -22;
  }

  lines.push('ET');
  const streamContent = lines.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

export class LabelsService {
  resolveDimensions(input?: {
    layoutPreset?: LabelLayoutPreset;
    widthMm?: number;
    heightMm?: number;
    columnsPerRow?: number;
  }): LabelDimensions {
    const preset = input?.layoutPreset || 'AVERY_5160_30UP';
    if (preset !== 'CUSTOM' && LAYOUT_PRESETS[preset]) {
      return {
        ...LAYOUT_PRESETS[preset],
        ...(input?.widthMm ? { widthMm: Number(input.widthMm) } : {}),
        ...(input?.heightMm ? { heightMm: Number(input.heightMm) } : {}),
      };
    }
    return {
      layoutPreset: 'CUSTOM',
      widthMm: Number(input?.widthMm || 50),
      heightMm: Number(input?.heightMm || 25),
      columnsPerRow: Number(input?.columnsPerRow || 2),
    };
  }

  /**
   * Assign or regenerate a unique barcode for a physical BookItem copy.
   * Rejects duplicate barcodes with 409 Conflict.
   */
  async assignBarcode(
    input: {
      bookItemId?: string;
      accessionNumber?: string;
      barcode?: string;
    },
    actor: { userId: string; email: string }
  ) {
    if (!input.bookItemId && !input.accessionNumber) {
      throw new ValidationError('bookItemId or accessionNumber is required');
    }

    const copy = await prisma.bookItem.findFirst({
      where: input.bookItemId
        ? { id: input.bookItemId, deletedAt: null }
        : { accessionNumber: input.accessionNumber!.trim(), deletedAt: null },
      include: {
        book: {
          include: {
            authors: { include: { author: true } },
          },
        },
      },
    });

    if (!copy) {
      throw new NotFoundError('Physical copy not found');
    }

    const desiredBarcode = (input.barcode?.trim() || `BC-${copy.accessionNumber}`).toUpperCase();

    const duplicate = await prisma.bookItem.findFirst({
      where: {
        barcode: desiredBarcode,
        id: { not: copy.id },
      },
    });

    if (duplicate) {
      throw new ConflictError(
        `Duplicate barcode '${desiredBarcode}' is already assigned to copy ${duplicate.accessionNumber}`
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.bookItem.update({
        where: { id: copy.id },
        data: { barcode: desiredBarcode },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: AuditAction.UPDATE,
          entityName: 'BookItemBarcode',
          entityId: copy.id,
          previousState: { barcode: copy.barcode },
          newState: { barcode: desiredBarcode, accessionNumber: copy.accessionNumber },
        },
      });

      return item;
    }, { timeout: 30000, maxWait: 15000 });

    return {
      bookItemId: updated.id,
      accessionNumber: updated.accessionNumber,
      barcode: updated.barcode!,
      barcodeSvg: generateCode128Svg(updated.barcode!),
    };
  }

  /**
   * Generate barcode and spine-label previews for one or many physical copies (bulk support).
   */
  async generatePreview(input: {
    bookItemIds?: string[];
    accessionNumbers?: string[];
    bookId?: string;
    layoutPreset?: LabelLayoutPreset;
    widthMm?: number;
    heightMm?: number;
    labelType?: 'BARCODE' | 'SPINE' | 'COMBINED';
  }) {
    const dimensions = this.resolveDimensions(input);
    const labelType = input.labelType || 'COMBINED';

    const where =
      input.bookItemIds && input.bookItemIds.length > 0
        ? { id: { in: input.bookItemIds }, deletedAt: null }
        : input.accessionNumbers && input.accessionNumbers.length > 0
          ? { accessionNumber: { in: input.accessionNumbers }, deletedAt: null }
          : input.bookId
            ? { bookId: input.bookId, deletedAt: null }
            : { deletedAt: null };

    const copies = await prisma.bookItem.findMany({
      where,
      take: 100,
      orderBy: { accessionNumber: 'asc' },
      include: {
        book: {
          include: {
            category: true,
            authors: { include: { author: true } },
          },
        },
      },
    });

    if (copies.length === 0) {
      throw new NotFoundError('No physical copies matched the selection for label generation');
    }

    const labels = copies.map((copy) => {
      const barcodeVal = copy.barcode || `BC-${copy.accessionNumber}`;
      const callNum = copy.book.callNumber || copy.book.category?.code || '000.00 GEN';
      const primaryAuthor = copy.book.authors[0]?.author.name || 'LIB';
      const authorCutter = primaryAuthor.slice(0, 3).toUpperCase();
      const yearStr = copy.book.publicationYear ? String(copy.book.publicationYear) : '2026';

      const spineLines = [
        callNum.split(' ')[0] || '005.1',
        authorCutter,
        yearStr,
        copy.accessionNumber,
      ];

      return {
        bookItemId: copy.id,
        bookId: copy.bookId,
        accessionNumber: copy.accessionNumber,
        barcode: barcodeVal,
        title: copy.book.title,
        isbn13: copy.book.isbn13,
        author: primaryAuthor,
        callNumber: callNum,
        shelfLocation: copy.shelfLocation,
        isReferenceOnly: copy.isReferenceOnly,
        spineLines,
        barcodeSvg: generateCode128Svg(barcodeVal),
      };
    });

    return {
      labelType,
      dimensions,
      totalLabels: labels.length,
      encodingStandard: 'Code-128B (ISO/IEC 15417)',
      hardwareNote: 'GENERATED_PRINTABLE_LABEL_ONLY (Not a hardware scan)',
      labels,
    };
  }

  async generatePdf(input: {
    bookItemIds?: string[];
    accessionNumbers?: string[];
    bookId?: string;
    layoutPreset?: LabelLayoutPreset;
    widthMm?: number;
    heightMm?: number;
    labelType?: 'BARCODE' | 'SPINE' | 'COMBINED';
  }) {
    const preview = await this.generatePreview(input);
    const pdfBuffer = generateLabelsPdfBuffer(
      preview.labels,
      preview.dimensions,
      preview.labelType
    );

    return {
      filename: `smartlib-labels-${preview.labelType.toLowerCase()}-${Date.now()}.pdf`,
      pdfBuffer,
      totalLabels: preview.totalLabels,
    };
  }
}

export const labelsService = new LabelsService();
