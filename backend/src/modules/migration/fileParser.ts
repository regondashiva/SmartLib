import * as XLSX from 'xlsx';
import { ValidationError } from '../../utils/errors.js';

export interface ParsedMigrationRow {
  rowNumber: number;
  rawPayload: Record<string, unknown>;
  mappedFields: Record<string, unknown>;
  unmappedFields: Record<string, unknown>;
}

// Canonical field keys supported by SmartLib
export const CANONICAL_FIELDS = [
  'title',
  'subtitle',
  'isbn13',
  'isbn10',
  'authors',
  'publisher',
  'category',
  'edition',
  'publicationYear',
  'language',
  'callNumber',
  'accessionNumber',
  'barcode',
  'shelfLocation',
  'copiesCount',
  'condition',
  'price',
  'isReferenceOnly',
  'description',
] as const;

export type CanonicalField = typeof CANONICAL_FIELDS[number];

// Comprehensive alias dictionary for legacy LMS systems (Koha, LibSys, Marc21, Sierra, etc.)
const FIELD_ALIASES: Record<CanonicalField, string[]> = {
  title: ['title', 'book_title', 'booktitle', 'item_title', 'name', 'main_title', 'title_statement'],
  subtitle: ['subtitle', 'sub_title', 'remainder_of_title'],
  isbn13: ['isbn13', 'isbn_13', 'isbn-13', 'isbn', 'isbn_no', 'isbnno', 'international_standard_book_number', '020$a'],
  isbn10: ['isbn10', 'isbn_10', 'isbn-10'],
  authors: ['authors', 'author', 'writer', 'creator', 'contributors', 'primary_author', 'author_name', 'authorname', '100$a', '700$a'],
  publisher: ['publisher', 'pub', 'publisher_name', 'publisher_house', 'publisherhouse', 'imprint', 'publication_details', '260$b', '264$b'],
  category: ['category', 'genre', 'subject', 'classification_name', 'topic', 'collection', '650$a'],
  edition: ['edition', 'ed', 'edition_statement', '250$a'],
  publicationYear: ['publicationyear', 'publication_year', 'publish_year', 'publishyear', 'pub_year', 'year', 'date', 'pubdate', 'copyright_year', '260$c', '264$c'],
  language: ['language', 'lang', 'language_code', '041$a'],
  callNumber: ['callnumber', 'call_number', 'callno', 'classification', 'dewey', 'ddc', 'loc_class', '082$a', '050$a'],
  accessionNumber: ['accessionnumber', 'accession_no', 'accession_number', 'accessionno', 'acc_no', 'accno', 'accession', 'barcode_number'],
  barcode: ['barcode', 'item_barcode', 'copy_barcode'],
  shelfLocation: ['shelflocation', 'shelf_location', 'shelf', 'location', 'stack', 'stacks', 'sublocation', 'holding_branch'],
  copiesCount: ['copiescount', 'copies_count', 'copies', 'copy_count', 'quantity', 'num_copies', 'numcopies', 'items_count'],
  condition: ['condition', 'copy_condition', 'physical_condition', 'state'],
  price: ['price', 'cost', 'item_price', 'amount', 'replacement_price'],
  isReferenceOnly: ['isreferenceonly', 'reference_only', 'ref_only', 'reference', 'non_circulating', 'circulating_status'],
  description: ['description', 'summary', 'abstract', 'notes', '520$a', '500$a'],
};

/**
 * Formula Injection Sanitization
 * Prefixes cells beginning with =, +, -, or @ with an apostrophe to prevent CSV/Excel injection
 */
export function sanitizeCellValue(val: unknown): unknown {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^[=+\-@\t\r]/.test(trimmed)) {
      return `'${trimmed}`;
    }
    return trimmed;
  }
  return val;
}

/**
 * Normalizes a header string for alias matching (lowercased, alphanumeric only)
 */
export function normalizeHeaderKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9$]/g, '');
}

/**
 * Builds an automated mapping dictionary from column names to canonical fields
 */
export function buildColumnMapping(
  headers: string[],
  userMapping?: Record<string, string>
): Record<string, CanonicalField | null> {
  const result: Record<string, CanonicalField | null> = {};

  for (const rawHeader of headers) {
    // 1. Explicit user mapping override
    if (userMapping && userMapping[rawHeader]) {
      const target = userMapping[rawHeader] as CanonicalField;
      if (CANONICAL_FIELDS.includes(target)) {
        result[rawHeader] = target;
        continue;
      }
    }

    // 2. Automated fuzzy alias detection
    const normalized = normalizeHeaderKey(rawHeader);
    let matched: CanonicalField | null = null;

    for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.some((alias) => normalizeHeaderKey(alias) === normalized)) {
        matched = canonical as CanonicalField;
        break;
      }
    }

    result[rawHeader] = matched;
  }

  return result;
}

/**
 * Parses raw CSV string or buffer into row objects
 */
export function parseCsvContent(content: string): Record<string, unknown>[] {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentLine += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    throw new ValidationError('Uploaded CSV file is empty');
  }

  // Parse header line
  const parseRowCells = (line: string): string[] => {
    const cells: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      const nc = line[j + 1];

      if (c === '"') {
        if (inQuotes && nc === '"') {
          cell += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += c;
      }
    }
    cells.push(cell.trim());
    return cells;
  };

  const headers = parseRowCells(lines[0] || '').map((h) => h.replace(/^"|"$/g, '').trim());
  if (headers.length === 0 || headers.every((h) => !h)) {
    throw new ValidationError('Could not identify valid header columns in CSV');
  }

  const rows: Record<string, unknown>[] = [];
  for (let k = 1; k < lines.length; k++) {
    const rowCells = parseRowCells(lines[k] || '');
    if (rowCells.every((c) => !c)) continue; // skip blank line

    const rowObj: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = sanitizeCellValue(rowCells[idx] ?? '');
    });
    rows.push(rowObj);
  }

  return rows;
}

/**
 * Parses XLSX buffer into row objects
 */
export function parseXlsxContent(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new ValidationError('Uploaded Excel workbook contains no sheets');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new ValidationError('First sheet in Excel workbook is empty');
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });

  if (rawRows.length === 0) {
    throw new ValidationError('Excel sheet contains no data rows');
  }

  // Sanitize every row
  return rawRows.map((row) => {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      sanitized[key] = sanitizeCellValue(val);
    }
    return sanitized;
  });
}

/**
 * Parses uploaded file buffer (CSV, XLSX, or JSON) with mapping resolution
 */
export function parseUploadedFile(
  buffer: Buffer,
  originalFilename: string,
  userMapping?: Record<string, string>
): {
  rows: ParsedMigrationRow[];
  headers: string[];
  mapping: Record<string, CanonicalField | null>;
  totalRows: number;
} {
  const ext = originalFilename.split('.').pop()?.toLowerCase();
  let rawRows: Record<string, unknown>[] = [];

  if (ext === 'csv' || ext === 'txt') {
    const content = buffer.toString('utf-8');
    rawRows = parseCsvContent(content);
  } else if (ext === 'xlsx' || ext === 'xls') {
    rawRows = parseXlsxContent(buffer);
  } else if (ext === 'json') {
    try {
      const parsed = JSON.parse(buffer.toString('utf-8'));
      if (Array.isArray(parsed)) {
        rawRows = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.records)) {
        rawRows = parsed.records;
      } else {
        throw new Error('JSON structure must be an array of records');
      }
    } catch (err) {
      throw new ValidationError(`Malformed JSON file: ${(err as Error).message}`);
    }
  } else {
    throw new ValidationError(
      `Unsupported file extension '.${ext}'. SmartLib supports CSV (.csv), Excel (.xlsx), and JSON (.json).`
    );
  }

  if (rawRows.length === 0) {
    throw new ValidationError('No records found in uploaded file');
  }

  // Determine all distinct headers
  const headerSet = new Set<string>();
  for (const row of rawRows) {
    Object.keys(row).forEach((k) => headerSet.add(k));
  }
  const headers = Array.from(headerSet);

  // Compute mapping
  const mapping = buildColumnMapping(headers, userMapping);

  // Structure rows
  const parsedRows: ParsedMigrationRow[] = rawRows.map((raw, idx) => {
    const mapped: Record<string, unknown> = {};
    const unmapped: Record<string, unknown> = {};

    for (const [colName, val] of Object.entries(raw)) {
      const targetField = mapping[colName];
      if (targetField) {
        mapped[targetField] = val;
      } else {
        unmapped[colName] = val;
      }
    }

    return {
      rowNumber: idx + 1,
      rawPayload: raw,
      mappedFields: mapped,
      unmappedFields: unmapped,
    };
  });

  return {
    rows: parsedRows,
    headers,
    mapping,
    totalRows: parsedRows.length,
  };
}
