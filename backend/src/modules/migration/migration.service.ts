import { prisma } from '../../config/prisma.js';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/errors.js';
import { CreateBatchInput, ListBatchesQuery, PreviewQuery } from './migration.schema.js';
import {
  parseUploadedFile,
  CanonicalField,
} from './fileParser.js';
import {
  Prisma,
  MigrationStatus,
  StagingRecordStatus,
  AuditAction,
  ItemStatus,
  ItemCondition,
} from '@prisma/client';

export interface NormalizedMigrationRecord {
  title: string;
  subtitle?: string | null;
  authors: string[];
  isbn13: string | null;
  isbn10: string | null;
  callNumber: string | null;
  publisher: string | null;
  category: string | null;
  edition?: string | null;
  publicationYear: number | null;
  language: string;
  copiesCount: number;
  shelfLocation: string;
  condition: ItemCondition;
  price: number | null;
  isReferenceOnly: boolean;
  accessionNumber?: string | null;
  barcode?: string | null;
  description?: string | null;
  unmappedFields?: Record<string, unknown>;
  createdBookId?: string;
  createdAccessionNumbers?: string[];
}

export class MigrationService {
  /**
   * 1a. Upload file (CSV, XLSX, JSON) and stage records
   */
  async uploadAndStageFile(
    fileBuffer: Buffer,
    originalFilename: string,
    executedByUserId: string,
    options?: { batchName?: string; mapping?: Record<string, string> }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: executedByUserId },
    });
    if (!user) {
      throw new NotFoundError('Executing administrator not found');
    }

    // 1. Parse and extract records with auto-mapping
    const parsed = parseUploadedFile(fileBuffer, originalFilename, options?.mapping);

    const batchName =
      options?.batchName?.trim() ||
      `Batch-${originalFilename.replace(/\.[^/.]+$/, '')}-${Date.now().toString().slice(-6)}`;

    // 2. Create MigrationBatch
    const batch = await prisma.migrationBatch.create({
      data: {
        batchName,
        sourceFileName: originalFilename,
        totalRecords: parsed.totalRows,
        validRecords: 0,
        errorRecords: 0,
        migratedRecords: 0,
        status: MigrationStatus.UPLOADED,
        executedByUserId,
        dryRunSummary: {
          detectedHeaders: parsed.headers,
          columnMapping: parsed.mapping,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // 3. Bulk stage records in chunks of 500
    const chunkSize = 500;
    for (let i = 0; i < parsed.rows.length; i += chunkSize) {
      const slice = parsed.rows.slice(i, i + chunkSize);
      const stagingData = slice.map((row) => ({
        batchId: batch.id,
        rowNumber: row.rowNumber,
        rawPayload: {
          ...row.rawPayload,
          _mapped: row.mappedFields,
          _unmapped: row.unmappedFields,
        } as Prisma.InputJsonValue,
        status: StagingRecordStatus.PENDING,
      }));

      await prisma.migrationStagingRecord.createMany({
        data: stagingData,
      });
    }

    return {
      batchId: batch.id,
      id: batch.id,
      batch,
      headers: parsed.headers,
      mapping: parsed.mapping,
      totalStaged: parsed.totalRows,
      totalRecords: parsed.totalRows,
      status: batch.status,
      sample: parsed.rows.slice(0, 3).map((r) => r.mappedFields),
    };
  }

  /**
   * 1b. Create Migration Batch from JSON records (API fallback)
   */
  async createBatch(input: CreateBatchInput, executedByUserId: string) {
    const { batchName, sourceFileName, records, mapping } = input;

    const user = await prisma.user.findUnique({
      where: { id: executedByUserId },
    });
    if (!user) {
      throw new NotFoundError('Executing user not found');
    }

    const batch = await prisma.migrationBatch.create({
      data: {
        batchName,
        sourceFileName,
        totalRecords: records.length,
        validRecords: 0,
        errorRecords: 0,
        migratedRecords: 0,
        status: MigrationStatus.UPLOADED,
        executedByUserId,
        dryRunSummary: {
          columnMapping: mapping ?? {},
        } as unknown as Prisma.InputJsonValue,
      },
    });

    const chunkSize = 500;
    for (let i = 0; i < records.length; i += chunkSize) {
      const slice = records.slice(i, i + chunkSize);
      const stagingData = slice.map((raw, idx) => ({
        batchId: batch.id,
        rowNumber: i + idx + 1,
        rawPayload: raw as Prisma.InputJsonValue,
        status: StagingRecordStatus.PENDING,
      }));

      await prisma.migrationStagingRecord.createMany({
        data: stagingData,
      });
    }

    return batch;
  }

  /**
   * 2. Validate staged records: detect duplicate ISBNs, invalid formats, missing required fields
   */
  async validateBatch(batchId: string, _actorUserId?: string) {
    const batch = await prisma.migrationBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new NotFoundError(`Migration batch '${batchId}' not found`);
    }

    if (batch.status === MigrationStatus.COMMITTED) {
      throw new ConflictError('Cannot re-validate an already committed batch');
    }

    await prisma.migrationBatch.update({
      where: { id: batchId },
      data: { status: MigrationStatus.VALIDATING },
    });

    // Fetch existing books & accession numbers from catalog for cross-database collision detection
    const [existingBooks, existingCopies] = await Promise.all([
      prisma.book.findMany({
        where: { deletedAt: null },
        select: { isbn13: true, title: true },
      }),
      prisma.bookItem.findMany({
        where: { deletedAt: null },
        select: { accessionNumber: true },
      }),
    ]);

    const catalogIsbns = new Set(
      existingBooks.map((b) => b.isbn13).filter(Boolean) as string[]
    );
    const catalogAccessions = new Set(
      existingCopies.map((c) => c.accessionNumber).filter(Boolean) as string[]
    );

    const stagingRecords = await prisma.migrationStagingRecord.findMany({
      where: { batchId },
      orderBy: { rowNumber: 'asc' },
    });

    const seenBatchIsbns = new Set<string>();
    const seenBatchAccessions = new Set<string>();
    let validCount = 0;
    let errorCount = 0;

    interface StagingUpdateItem {
      id: string;
      status: StagingRecordStatus;
      normalizedPayload?: Prisma.InputJsonValue;
      validationErrors?: any;
    }
    const updates: StagingUpdateItem[] = [];

    for (const record of stagingRecords) {
      const raw = record.rawPayload as Record<string, unknown>;
      // Look in _mapped first if available, else raw
      const mapped = (raw['_mapped'] as Record<string, unknown>) || raw;
      const unmapped = (raw['_unmapped'] as Record<string, unknown>) || {};
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate Title (Required)
      const titleRaw = mapped['title'] ?? raw['title'] ?? raw['book_title'] ?? raw['Book Title'];
      const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';
      if (!title) {
        errors.push('Title is missing or empty');
      }

      // Validate Subtitle (Optional)
      const subtitleRaw = mapped['subtitle'] ?? raw['subtitle'];
      const subtitle = typeof subtitleRaw === 'string' && subtitleRaw.trim() ? subtitleRaw.trim() : null;

      // Validate ISBN
      let isbn13: string | null = null;
      let isbn10: string | null = null;
      const rawIsbnField = mapped['isbn13'] ?? mapped['isbn'] ?? raw['isbn13'] ?? raw['isbn'] ?? raw['ISBN'];

      if (rawIsbnField) {
        const cleanIsbn = String(rawIsbnField).replace(/[-\s]/g, '').trim();
        if (cleanIsbn.length === 13 && /^\d{13}$/.test(cleanIsbn)) {
          isbn13 = cleanIsbn;
        } else if (cleanIsbn.length === 10 && /^[\dX]{10}$/i.test(cleanIsbn)) {
          isbn10 = cleanIsbn.toUpperCase();
        } else if (cleanIsbn) {
          errors.push(`Invalid ISBN format: '${rawIsbnField}'. Must be 10 or 13 digits.`);
        }
      }

      if (isbn13) {
        if (catalogIsbns.has(isbn13)) {
          errors.push(`Duplicate ISBN-13 '${isbn13}' already exists in library catalog`);
        }
        if (seenBatchIsbns.has(isbn13)) {
          errors.push(`Duplicate ISBN-13 '${isbn13}' appears multiple times in batch file`);
        }
        seenBatchIsbns.add(isbn13);
      }

      // Validate Accession Number (if supplied)
      const rawAcc = mapped['accessionNumber'] ?? raw['accessionNumber'] ?? raw['accession_no'] ?? raw['Accession'];
      let accessionNumber: string | null = null;
      if (rawAcc) {
        accessionNumber = String(rawAcc).trim();
        if (catalogAccessions.has(accessionNumber)) {
          errors.push(`Accession number '${accessionNumber}' already exists in catalog`);
        }
        if (seenBatchAccessions.has(accessionNumber)) {
          errors.push(`Accession number '${accessionNumber}' appears multiple times in batch`);
        }
        seenBatchAccessions.add(accessionNumber);
      }

      // Normalize Authors
      let authors: string[] = [];
      const authorsField = mapped['authors'] ?? mapped['author'] ?? raw['authors'] ?? raw['author'] ?? raw['Author'];
      if (Array.isArray(authorsField)) {
        authors = authorsField.map(String).map((a) => a.trim()).filter(Boolean);
      } else if (typeof authorsField === 'string' && authorsField.trim()) {
        authors = authorsField.split(/[,;&]/).map((a) => a.trim()).filter(Boolean);
      }

      if (authors.length === 0) {
        warnings.push('No authors specified for record (will default to Unknown Author)');
      }

      // Normalize copies count
      let copiesCount = 1;
      const copiesRaw = mapped['copiesCount'] ?? mapped['copies'] ?? raw['copiesCount'] ?? raw['copies'];
      if (copiesRaw !== undefined && copiesRaw !== '') {
        const parsed = parseInt(String(copiesRaw), 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
          copiesCount = parsed;
        } else {
          warnings.push(`Invalid copiesCount '${copiesRaw}'. Defaulted to 1.`);
        }
      }

      // Normalize year
      let publicationYear: number | null = null;
      const yearRaw = mapped['publicationYear'] ?? mapped['year'] ?? raw['publicationYear'] ?? raw['year'];
      if (yearRaw !== undefined && yearRaw !== '') {
        const parsedYear = parseInt(String(yearRaw), 10);
        if (!isNaN(parsedYear) && parsedYear > 1000 && parsedYear <= new Date().getFullYear() + 2) {
          publicationYear = parsedYear;
        } else {
          warnings.push(`Invalid publication year '${yearRaw}' ignored.`);
        }
      }

      // Normalize price
      let price: number | null = null;
      const priceRaw = mapped['price'] ?? raw['price'] ?? raw['cost'];
      if (priceRaw !== undefined && priceRaw !== '') {
        const parsedPrice = parseFloat(String(priceRaw).replace(/[^0-9.]/g, ''));
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          price = Math.round(parsedPrice * 100) / 100;
        }
      }

      // Condition validation
      let condition: ItemCondition = ItemCondition.GOOD;
      const condRaw = mapped['condition'] ?? raw['condition'];
      if (condRaw && typeof condRaw === 'string') {
        const upper = condRaw.toUpperCase().trim();
        if (['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'].includes(upper)) {
          condition = upper as ItemCondition;
        }
      }

      // Reference only
      const refRaw = mapped['isReferenceOnly'] ?? raw['isReferenceOnly'] ?? raw['reference_only'];
      const isReferenceOnly =
        refRaw === true ||
        refRaw === 'true' ||
        refRaw === '1' ||
        refRaw === 'yes' ||
        refRaw === 'Y';

      // Call number
      const callNumberRaw = mapped['callNumber'] ?? raw['callNumber'] ?? raw['call_number'];
      const callNumber = typeof callNumberRaw === 'string' && callNumberRaw.trim() ? callNumberRaw.trim() : null;

      // Publisher & Category
      const pubRaw = mapped['publisher'] ?? raw['publisher'];
      const publisher = typeof pubRaw === 'string' && pubRaw.trim() ? pubRaw.trim() : null;

      const catRaw = mapped['category'] ?? raw['category'];
      const category = typeof catRaw === 'string' && catRaw.trim() ? catRaw.trim() : null;

      // Shelf Location
      const shelfRaw = mapped['shelfLocation'] ?? raw['shelfLocation'] ?? raw['location'];
      const shelfLocation = typeof shelfRaw === 'string' && shelfRaw.trim() ? shelfRaw.trim() : 'MAIN-STACKS';

      // Language
      const langRaw = mapped['language'] ?? raw['language'];
      const language = typeof langRaw === 'string' && langRaw.trim() ? langRaw.trim() : 'English';

      const isValid = errors.length === 0;

      if (isValid) {
        validCount++;
        const normalized: NormalizedMigrationRecord = {
          title,
          subtitle,
          authors: authors.length > 0 ? authors : ['Unknown Author'],
          isbn13,
          isbn10,
          callNumber,
          publisher,
          category,
          edition: mapped['edition'] ? String(mapped['edition']).trim() : null,
          publicationYear,
          language,
          copiesCount,
          shelfLocation,
          condition,
          price,
          isReferenceOnly,
          accessionNumber,
          barcode: mapped['barcode'] ? String(mapped['barcode']).trim() : null,
          description: mapped['description'] ? String(mapped['description']).trim() : null,
          unmappedFields: unmapped,
        };

        updates.push({
          id: record.id,
          status: StagingRecordStatus.VALID,
          normalizedPayload: normalized as unknown as Prisma.InputJsonValue,
          validationErrors: warnings.length > 0 ? (warnings as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        });
      } else {
        errorCount++;
        updates.push({
          id: record.id,
          status: StagingRecordStatus.INVALID,
          validationErrors: errors as unknown as Prisma.InputJsonValue,
        });
      }
    }

    // Flush updates in fast bulk SQL chunks of 500 records each
    const BATCH_SIZE = 500;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const slice = updates.slice(i, i + BATCH_SIZE);
      const valuesSql = slice
        .map((u) => {
          const normJson = u.normalizedPayload
            ? `'${JSON.stringify(u.normalizedPayload).replace(/'/g, "''")}'::jsonb`
            : 'NULL::jsonb';
          const errJson = u.validationErrors
            ? `'${JSON.stringify(u.validationErrors).replace(/'/g, "''")}'::jsonb`
            : 'NULL::jsonb';
          return `('${u.id}', '${u.status}'::"StagingRecordStatus", ${normJson}, ${errJson})`;
        })
        .join(',\n');

      await prisma.$executeRawUnsafe(`
        UPDATE migration_staging_records AS m
        SET status = v.status,
            "normalizedPayload" = v.normalized_payload,
            "validationErrors" = v.validation_errors
        FROM (VALUES ${valuesSql}) AS v(id, status, normalized_payload, validation_errors)
        WHERE m.id = v.id;
      `);
    }

    const updatedBatch = await prisma.migrationBatch.update({
      where: { id: batchId },
      data: {
        validRecords: validCount,
        errorRecords: errorCount,
        status: MigrationStatus.VALIDATED,
      },
    });

    return updatedBatch;
  }

  /**
   * 3. Execute Dry Run simulation without writing to production catalog
   */
  async dryRunBatch(batchId: string, _actorUserId?: string) {
    const batch = await prisma.migrationBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new NotFoundError(`Migration batch '${batchId}' not found`);
    }

    if (batch.status === MigrationStatus.UPLOADED) {
      await this.validateBatch(batchId);
    }

    const validRecords = await prisma.migrationStagingRecord.findMany({
      where: { batchId, status: StagingRecordStatus.VALID },
    });

    const publishers = new Set<string>();
    const categories = new Set<string>();
    const authors = new Set<string>();
    let totalCopiesToCreate = 0;

    for (const rec of validRecords) {
      const norm = rec.normalizedPayload as unknown as NormalizedMigrationRecord;
      if (norm.publisher) publishers.add(norm.publisher);
      if (norm.category) categories.add(norm.category);
      norm.authors.forEach((a) => authors.add(a));
      totalCopiesToCreate += norm.copiesCount || 1;
    }

    const dryRunSummary = {
      simulatedAt: new Date().toISOString(),
      sourceRecordCount: batch.totalRecords,
      validRecordCount: validRecords.length,
      invalidRecordCount: batch.errorRecords,
      estimatedNewBooks: validRecords.length,
      estimatedNewCopies: totalCopiesToCreate,
      estimatedPublishers: publishers.size,
      estimatedCategories: categories.size,
      estimatedAuthors: authors.size,
      reconciliation: {
        sourceTotal: batch.totalRecords,
        readyToCommit: validRecords.length,
        rejected: batch.errorRecords,
        successRatePercentage:
          batch.totalRecords > 0
            ? Math.round((validRecords.length / batch.totalRecords) * 1000) / 10
            : 0,
      },
      canCommit: validRecords.length > 0,
    };

    const updated = await prisma.migrationBatch.update({
      where: { id: batchId },
      data: {
        dryRunSummary: dryRunSummary as unknown as Prisma.InputJsonValue,
        status: MigrationStatus.DRY_RUN_COMPLETED,
      },
    });

    return {
      batch: updated,
      status: updated.status,
      dryRunSummary,
      summary: dryRunSummary,
    };
  }

  /**
   * 4. Preview sample records and errors
   */
  async previewBatch(batchId: string, sampleLimit = 50, filterStatus = 'ALL') {
    const batch = await prisma.migrationBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new NotFoundError(`Migration batch '${batchId}' not found`);
    }

    const whereClause: Prisma.MigrationStagingRecordWhereInput = { batchId };
    if (filterStatus === 'VALID') whereClause.status = StagingRecordStatus.VALID;
    if (filterStatus === 'INVALID') whereClause.status = StagingRecordStatus.INVALID;
    if (filterStatus === 'COMMITTED') whereClause.status = StagingRecordStatus.COMMITTED;

    const [records, validCount, invalidCount] = await Promise.all([
      prisma.migrationStagingRecord.findMany({
        where: whereClause,
        take: sampleLimit,
        orderBy: { rowNumber: 'asc' },
      }),
      prisma.migrationStagingRecord.count({
        where: { batchId, status: StagingRecordStatus.VALID },
      }),
      prisma.migrationStagingRecord.count({
        where: { batchId, status: StagingRecordStatus.INVALID },
      }),
    ]);

    const totalFiltered =
      filterStatus === 'VALID'
        ? validCount
        : filterStatus === 'INVALID'
        ? invalidCount
        : batch.totalRecords;

    return {
      batch,
      summary: {
        totalRecords: batch.totalRecords,
        validCount,
        errorCount: invalidCount,
        sampleReturned: records.length,
      },
      pagination: {
        total: totalFiltered,
        page: 1,
        limit: sampleLimit,
      },
      records: records.map((r) => ({
        id: r.id,
        rowNumber: r.rowNumber,
        status: r.status,
        normalized: r.normalizedPayload,
        errors: r.validationErrors,
        raw: r.rawPayload,
      })),
    };
  }

  /**
   * 5. Commit validated records into real catalog in safe, resilient transactions
   */
  async commitBatch(batchId: string, executedByUserId: string) {
    const batch = await prisma.migrationBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new NotFoundError(`Migration batch '${batchId}' not found`);
    }

    if (batch.status === MigrationStatus.COMMITTED) {
      throw new ConflictError('Batch has already been committed to the institutional catalog');
    }

    if (batch.status !== MigrationStatus.VALIDATED && batch.status !== MigrationStatus.DRY_RUN_COMPLETED) {
      throw new ValidationError(
        `Batch status must be VALIDATED or DRY_RUN_COMPLETED to commit. Current status: ${batch.status}`
      );
    }

    const validRecords = await prisma.migrationStagingRecord.findMany({
      where: { batchId, status: StagingRecordStatus.VALID },
      orderBy: { rowNumber: 'asc' },
    });

    if (validRecords.length === 0) {
      throw new ValidationError('Batch contains 0 valid records to commit');
    }

    const currentYear = new Date().getFullYear();
    const prefix = `ACC-${currentYear}-`;

    // Process in safe transactions of 10 records each to avoid connection pool timeouts on Neon serverless
    const CHUNK_SIZE = 10;
    let committedBooksCount = 0;
    let committedCopiesCount = 0;
    const allCreatedBookIds: string[] = [];

    // Find starting accession number
    const latestItem = await prisma.bookItem.findFirst({
      where: { accessionNumber: { startsWith: prefix } },
      orderBy: { accessionNumber: 'desc' },
      select: { accessionNumber: true },
    });

    let currentSeq = 1;
    if (latestItem?.accessionNumber) {
      const num = parseInt(latestItem.accessionNumber.replace(prefix, ''), 10);
      if (!isNaN(num)) currentSeq = num + 1;
    }

    for (let cIdx = 0; cIdx < validRecords.length; cIdx += CHUNK_SIZE) {
      const chunk = validRecords.slice(cIdx, cIdx + CHUNK_SIZE);

      await prisma.$transaction(async (tx) => {
        for (const staging of chunk) {
          const rec = staging.normalizedPayload as unknown as NormalizedMigrationRecord;

          // Upsert Publisher
          let publisherId: string | null = null;
          if (rec.publisher) {
            const pub = await tx.publisher.upsert({
              where: { name: rec.publisher },
              update: {},
              create: { name: rec.publisher },
            });
            publisherId = pub.id;
          }

          // Upsert Category
          let categoryId: string | null = null;
          if (rec.category) {
            const cat = await tx.category.upsert({
              where: { name: rec.category },
              update: {},
              create: { name: rec.category },
            });
            categoryId = cat.id;
          }

          // Upsert Authors
          const authorIds: string[] = [];
          for (const authorName of rec.authors) {
            let author = await tx.author.findFirst({
              where: { name: { equals: authorName, mode: 'insensitive' } },
            });
            if (!author) {
              author = await tx.author.create({
                data: { name: authorName },
              });
            }
            authorIds.push(author.id);
          }

          // Generate or assign accession numbers
          const copyAccessionNumbers: string[] = [];
          const count = rec.copiesCount || 1;
          for (let c = 0; c < count; c++) {
            if (c === 0 && rec.accessionNumber) {
              copyAccessionNumbers.push(rec.accessionNumber);
            } else {
              copyAccessionNumbers.push(`${prefix}${currentSeq.toString().padStart(5, '0')}`);
              currentSeq++;
            }
          }

          // Create Book and copies
          const book = await tx.book.create({
            data: {
              title: rec.title,
              subtitle: rec.subtitle,
              isbn13: rec.isbn13,
              isbn10: rec.isbn10,
              callNumber: rec.callNumber,
              edition: rec.edition,
              publicationYear: rec.publicationYear,
              language: rec.language || 'English',
              description: rec.description,
              publisherId,
              categoryId,
              authors: {
                create: authorIds.map((id) => ({ authorId: id })),
              },
              copies: {
                create: copyAccessionNumbers.map((accNum) => ({
                  accessionNumber: accNum,
                  shelfLocation: rec.shelfLocation || 'MAIN-STACKS',
                  condition: rec.condition || ItemCondition.GOOD,
                  isReferenceOnly: rec.isReferenceOnly || false,
                  status: ItemStatus.AVAILABLE,
                  price: rec.price ? new Prisma.Decimal(rec.price) : null,
                  barcode: rec.barcode || null,
                })),
              },
            },
          });

          allCreatedBookIds.push(book.id);
          committedBooksCount++;
          committedCopiesCount += copyAccessionNumbers.length;

          // Mark staging record as COMMITTED with reference to bookId
          await tx.migrationStagingRecord.update({
            where: { id: staging.id },
            data: {
              status: StagingRecordStatus.COMMITTED,
              normalizedPayload: {
                ...rec,
                createdBookId: book.id,
                createdAccessionNumbers: copyAccessionNumbers,
              } as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }, { timeout: 120000, maxWait: 30000 });
    }

    // Update Batch status and migrated records
    const updatedBatch = await prisma.migrationBatch.update({
      where: { id: batchId },
      data: {
        status: MigrationStatus.COMMITTED,
        migratedRecords: committedBooksCount,
      },
    });

    // Record Audit Log
    await prisma.auditLog.create({
      data: {
        actorUserId: executedByUserId,
        action: AuditAction.MIGRATION_EXECUTE,
        entityName: 'MigrationBatch',
        entityId: batchId,
        newState: {
          batchName: batch.batchName,
          committedBooksCount,
          committedCopiesCount,
          sourceFileName: batch.sourceFileName,
          sampleCreatedIds: allCreatedBookIds.slice(0, 5),
        },
      },
    });

    return {
      batch: updatedBatch,
      status: updatedBatch.status,
      migratedRecords: updatedBatch.migratedRecords,
      reconciliation: {
        totalRecords: batch.totalRecords,
        committedBooksCount,
        committedCopiesCount,
        errorRecords: batch.errorRecords,
      },
    };
  }

  /**
   * 6. Safely roll back a committed batch
   */
  async rollbackBatch(batchId: string, actorUserId: string) {
    const batch = await prisma.migrationBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new NotFoundError(`Migration batch '${batchId}' not found`);
    }

    if (batch.status !== MigrationStatus.COMMITTED) {
      throw new ValidationError(
        `Only COMMITTED batches can be rolled back. Current status: ${batch.status}`
      );
    }

    const committedStaging = await prisma.migrationStagingRecord.findMany({
      where: { batchId, status: StagingRecordStatus.COMMITTED },
    });

    const bookIdsToRollback: string[] = [];
    for (const st of committedStaging) {
      const norm = st.normalizedPayload as Record<string, unknown> | null;
      if (norm?.['createdBookId']) {
        bookIdsToRollback.push(norm['createdBookId'] as string);
      }
    }

    // Safety check: verify no copies created by this batch are on active loan
    if (bookIdsToRollback.length > 0) {
      const activeLoans = await prisma.circulation.count({
        where: {
          bookItem: { bookId: { in: bookIdsToRollback } },
          status: { in: ['ACTIVE', 'OVERDUE'] },
        },
      });

      if (activeLoans > 0) {
        throw new ConflictError(
          `Cannot rollback batch: ${activeLoans} copy/copies from this batch are currently checked out on active loan.`
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let deletedCopiesCount = 0;

      if (bookIdsToRollback.length > 0) {
        // Delete BookAuthors
        await tx.bookAuthor.deleteMany({
          where: { bookId: { in: bookIdsToRollback } },
        });

        // Count copies being deleted
        deletedCopiesCount = await tx.bookItem.count({
          where: { bookId: { in: bookIdsToRollback } },
        });

        // Delete BookItems
        await tx.bookItem.deleteMany({
          where: { bookId: { in: bookIdsToRollback } },
        });

        // Delete Books
        await tx.book.deleteMany({
          where: { id: { in: bookIdsToRollback } },
        });
      }

      // Revert staging records to VALID
      await tx.migrationStagingRecord.updateMany({
        where: { batchId, status: StagingRecordStatus.COMMITTED },
        data: { status: StagingRecordStatus.VALID },
      });

      // Update Batch
      const rolledBackBatch = await tx.migrationBatch.update({
        where: { id: batchId },
        data: {
          status: MigrationStatus.ROLLED_BACK,
          migratedRecords: 0,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: AuditAction.MIGRATION_ROLLBACK,
          entityName: 'MigrationBatch',
          entityId: batchId,
          newState: {
            status: MigrationStatus.ROLLED_BACK,
            deletedBooksCount: bookIdsToRollback.length,
            deletedCopiesCount,
          },
        },
      });

      return {
        batch: rolledBackBatch,
        status: rolledBackBatch.status,
        deletedBooksCount: bookIdsToRollback.length,
        deletedCopiesCount,
      };
    }, { timeout: 60000, maxWait: 20000 });

    return result;
  }

  /**
   * 7. Get or export errors
   */
  async getErrors(batchId: string, format = 'json') {
    const invalidRecords = await prisma.migrationStagingRecord.findMany({
      where: { batchId, status: StagingRecordStatus.INVALID },
      orderBy: { rowNumber: 'asc' },
    });

    if (format === 'csv') {
      const lines: string[] = ['Row,Field,Error,Raw Data'];
      for (const rec of invalidRecords) {
        const raw = rec.rawPayload as Record<string, unknown>;
        const title = `"${String(raw['title'] || raw['book_title'] || '').replace(/"/g, '""')}"`;
        const errors = `"${((rec.validationErrors as string[]) || []).join('; ').replace(/"/g, '""')}"`;
        const rawPayload = `"${JSON.stringify(raw).replace(/"/g, '""')}"`;
        lines.push(`${rec.rowNumber},${title},${errors},${rawPayload}`);
      }
      return lines.join('\n');
    }

    const errorsList = invalidRecords.map((r) => ({
      rowNumber: r.rowNumber,
      errors: r.validationErrors,
      validationErrors: r.validationErrors,
      raw: r.rawPayload,
    }));

    return {
      batchId,
      totalErrors: errorsList.length,
      errors: errorsList,
      items: errorsList,
    };
  }

  /**
   * 8. List batches
   */
  async listBatches(query: ListBatchesQuery) {
    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const { status } = query || {};
    const skip = (page - 1) * limit;
    const where: Prisma.MigrationBatchWhereInput = status ? { status } : {};

    const [total, batches] = await Promise.all([
      prisma.migrationBatch.count({ where }),
      prisma.migrationBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          executedByUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
    ]);

    return {
      batches,
      items: batches,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 9. Get batch by ID
   */
  async getBatchById(id: string) {
    const batch = await prisma.migrationBatch.findUnique({
      where: { id },
      include: {
        executedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!batch) {
      throw new NotFoundError(`Migration batch '${id}' not found`);
    }

    return batch;
  }
}

export const migrationService = new MigrationService();
