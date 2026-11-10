/**
 * SmartLib Multi-Page Standard PDF 1.4 Binary Generator
 * Produces 100% compliant, zero-dependency PDF documents for institutional reports.
 * Includes:
 * - SmartLib institutional header
 * - Report title & subtitle
 * - Date range & applied filters
 * - Generation timestamp & operator identity
 * - Accurate summary metrics boxes
 * - Tabular records with zebra striping
 * - Multi-page support & Page X of Y numbering
 */

export interface ReportMetric {
  label: string;
  value: string | number;
}

export interface ReportTableRow {
  [key: string]: string | number;
}

export interface PDFReportOptions {
  title: string;
  subtitle?: string;
  dateRange?: string;
  appliedFilters?: Record<string, string | number | undefined>;
  generatedBy?: string;
  metrics?: ReportMetric[];
  headers: string[];
  rows: (string | number)[][];
}

function escapePdfText(text: string): string {
  return String(text ?? '')
    .replace(/[^\x20-\x7E]/g, (ch) => {
      if (ch === '₹') return 'INR ';
      return '';
    })
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function sanitizeCsvCell(val: unknown): string {
  const raw = String(val ?? '');
  const trimmed = raw.trim();
  const safe = /^[=+\-@\t\r]/.test(trimmed) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildCsvDocument(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(',');
  const dataLines = rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(','));
  return [headerLine, ...dataLines].join('\n');
}

function buildPageStream(
  options: PDFReportOptions,
  pageRows: (string | number)[][],
  pageIndex: number,
  totalPages: number,
  generatedTimestamp: string,
  filterSummary: string
): string {
  const { title, subtitle, dateRange, generatedBy, metrics, headers } = options;
  const contentLines: string[] = [];

  // Institutional Top Banner
  contentLines.push('0.06 0.09 0.16 rg'); // #0F172A dark navy
  contentLines.push('40 725 532 50 re f');

  // Institutional Brand Sub-header
  contentLines.push('BT');
  contentLines.push('/F2 8 Tf');
  contentLines.push('0.58 0.64 0.72 rg'); // Slate-400
  contentLines.push('52 760 Td');
  contentLines.push('(SMARTLIB INSTITUTIONAL LIBRARY MANAGEMENT SYSTEM — OFFICIAL COMPLIANCE REPORT) Tj');
  contentLines.push('ET');

  // Main Report Title
  contentLines.push('BT');
  contentLines.push('/F2 15 Tf');
  contentLines.push('1 1 1 rg'); // White
  contentLines.push('52 738 Td');
  contentLines.push(`(${escapePdfText(title.toUpperCase())}) Tj`);
  contentLines.push('ET');

  // Metadata Line 1: Timestamp, Date Range, Operator
  let currentY = 708;
  contentLines.push('BT');
  contentLines.push('/F1 8.5 Tf');
  contentLines.push('0.39 0.45 0.55 rg'); // #64748B
  contentLines.push(`40 ${currentY} Td`);
  const metaStr = `Generated: ${generatedTimestamp} UTC  |  Date Range: ${dateRange || 'All Time'}  |  Operator: ${generatedBy || 'System Administrator'}`;
  contentLines.push(`(${escapePdfText(metaStr)}) Tj`);
  contentLines.push('ET');

  // Metadata Line 2: Applied Filters
  currentY -= 13;
  contentLines.push('BT');
  contentLines.push('/F1 8 Tf');
  contentLines.push('0.28 0.33 0.41 rg');
  contentLines.push(`40 ${currentY} Td`);
  contentLines.push(`(${escapePdfText(`Applied Filters: ${filterSummary}`)}) Tj`);
  contentLines.push('ET');

  if (subtitle && pageIndex === 0) {
    currentY -= 13;
    contentLines.push('BT');
    contentLines.push('/F1 8.5 Tf');
    contentLines.push('0.15 0.39 0.92 rg'); // #2563EB primary
    contentLines.push(`40 ${currentY} Td`);
    contentLines.push(`(${escapePdfText(subtitle)}) Tj`);
    contentLines.push('ET');
  }

  // Divider line
  currentY -= 8;
  contentLines.push('0.85 0.88 0.92 RG');
  contentLines.push('1 w');
  contentLines.push(`40 ${currentY} m 572 ${currentY} l S`);

  // KPI Metrics Summary Box (First Page Only)
  if (pageIndex === 0 && metrics && metrics.length > 0) {
    currentY -= 44;
    const displayMetrics = metrics.slice(0, 6);
    const boxWidth = Math.floor(532 / displayMetrics.length);
    displayMetrics.forEach((m, idx) => {
      const boxX = 40 + idx * boxWidth;
      contentLines.push('0.97 0.98 0.99 rg');
      contentLines.push(`${boxX} ${currentY} ${boxWidth - 6} 36 re f`);
      contentLines.push('0.85 0.88 0.92 RG');
      contentLines.push(`${boxX} ${currentY} ${boxWidth - 6} 36 re s`);

      // Metric Value
      contentLines.push('BT');
      contentLines.push('/F2 11 Tf');
      contentLines.push('0.07 0.1 0.15 rg');
      contentLines.push(`${boxX + 6} ${currentY + 19} Td`);
      contentLines.push(`(${escapePdfText(String(m.value))}) Tj`);
      contentLines.push('ET');

      // Metric Label
      contentLines.push('BT');
      contentLines.push('/F1 7.5 Tf');
      contentLines.push('0.39 0.45 0.55 rg');
      contentLines.push(`${boxX + 6} ${currentY + 7} Td`);
      contentLines.push(`(${escapePdfText(m.label.toUpperCase())}) Tj`);
      contentLines.push('ET');
    });
    currentY -= 12;
  }

  // Table Header
  currentY -= 20;
  contentLines.push('0.92 0.95 0.98 rg');
  contentLines.push(`40 ${currentY} 532 19 re f`);

  const colCount = Math.max(1, headers.length);
  const colWidth = Math.floor(532 / colCount);
  headers.forEach((h, idx) => {
    contentLines.push('BT');
    contentLines.push('/F2 8.5 Tf');
    contentLines.push('0.1 0.15 0.25 rg');
    contentLines.push(`${46 + idx * colWidth} ${currentY + 6} Td`);
    const maxHeaderLen = Math.max(6, Math.floor(colWidth / 5));
    const displayHeader = h.length > maxHeaderLen ? h.slice(0, maxHeaderLen - 1) + '.' : h;
    contentLines.push(`(${escapePdfText(displayHeader)}) Tj`);
    contentLines.push('ET');
  });

  // Table Rows
  if (pageRows.length === 0) {
    currentY -= 24;
    contentLines.push('BT');
    contentLines.push('/F1 9 Tf');
    contentLines.push('0.45 0.5 0.58 rg');
    contentLines.push(`48 ${currentY} Td`);
    contentLines.push('(No matching records found for the selected filter criteria.) Tj');
    contentLines.push('ET');
  } else {
    for (let r = 0; r < pageRows.length; r++) {
      currentY -= 17;
      if (currentY < 55) break;

      if (r % 2 === 1) {
        contentLines.push('0.98 0.98 0.99 rg');
        contentLines.push(`40 ${currentY - 2} 532 17 re f`);
      }

      contentLines.push('0.91 0.93 0.96 RG');
      contentLines.push(`40 ${currentY - 2} m 572 ${currentY - 2} l S`);

      const rowData = pageRows[r] || [];
      rowData.forEach((cell, idx) => {
        contentLines.push('BT');
        contentLines.push('/F1 8 Tf');
        contentLines.push('0.12 0.14 0.18 rg');
        contentLines.push(`${46 + idx * colWidth} ${currentY + 3} Td`);
        const maxLen = Math.max(6, Math.floor(colWidth / 5.2));
        const strCell = String(cell ?? '');
        const displayCell = strCell.length > maxLen ? strCell.slice(0, maxLen - 2) + '..' : strCell;
        contentLines.push(`(${escapePdfText(displayCell)}) Tj`);
        contentLines.push('ET');
      });
    }
  }

  // Footer with Page Number
  contentLines.push('0.85 0.88 0.92 RG');
  contentLines.push('40 42 m 572 42 l S');
  contentLines.push('BT');
  contentLines.push('/F1 8 Tf');
  contentLines.push('0.45 0.5 0.6 rg');
  contentLines.push('40 28 Td');
  contentLines.push('(SmartLib Institutional Library Management System — Official Audit Record) Tj');
  contentLines.push('ET');

  contentLines.push('BT');
  contentLines.push('/F2 8 Tf');
  contentLines.push('0.35 0.4 0.5 rg');
  contentLines.push('505 28 Td');
  contentLines.push(`(Page ${pageIndex + 1} of ${totalPages}) Tj`);
  contentLines.push('ET');

  return contentLines.join('\n');
}

export function generatePdfBuffer(options: PDFReportOptions): Buffer {
  const generatedTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Format applied filters string
  const filterParts: string[] = [];
  if (options.appliedFilters) {
    for (const [k, v] of Object.entries(options.appliedFilters)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        filterParts.push(`${k}=${v}`);
      }
    }
  }
  const filterSummary = filterParts.length > 0 ? filterParts.join(', ') : 'None (Full Institutional Scope)';

  const firstPageCap = 24;
  const nextPageCap = 30;
  const allRows = options.rows || [];

  const pagesRows: (string | number)[][][] = [];
  if (allRows.length <= firstPageCap) {
    pagesRows.push(allRows);
  } else {
    pagesRows.push(allRows.slice(0, firstPageCap));
    let offset = firstPageCap;
    while (offset < allRows.length && pagesRows.length < 10) {
      pagesRows.push(allRows.slice(offset, offset + nextPageCap));
      offset += nextPageCap;
    }
  }

  const totalPages = pagesRows.length;

  // Object allocation:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // For each page i (0..totalPages-1):
  //   pageObjId = 5 + i * 2
  //   contentObjId = 6 + i * 2
  const objects: string[] = [];
  objects[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

  const pageKids: string[] = [];
  for (let i = 0; i < totalPages; i++) {
    pageKids.push(`${5 + i * 2} 0 R`);
  }
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageKids.join(' ')}] /Count ${totalPages} >>\nendobj\n`;
  objects[3] =
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n';
  objects[4] =
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n';

  for (let i = 0; i < totalPages; i++) {
    const pageObjId = 5 + i * 2;
    const contentObjId = 6 + i * 2;
    const streamContent = buildPageStream(
      options,
      pagesRows[i] || [],
      i,
      totalPages,
      generatedTimestamp,
      filterSummary
    );
    const streamLength = Buffer.byteLength(streamContent, 'utf-8');

    objects[pageObjId] =
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`;
    objects[contentObjId] =
      `${contentObjId} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  }

  const maxObjId = 4 + totalPages * 2;
  let pdfOutput = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [0];

  for (let i = 1; i <= maxObjId; i++) {
    offsets[i] = Buffer.byteLength(pdfOutput, 'utf-8');
    pdfOutput += objects[i];
  }

  const xrefOffset = Buffer.byteLength(pdfOutput, 'utf-8');
  let xref = `xref\n0 ${maxObjId + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxObjId; i++) {
    const off = String(offsets[i]).padStart(10, '0');
    xref += `${off} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${maxObjId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  pdfOutput += xref + trailer;

  return Buffer.from(pdfOutput, 'utf-8');
}
