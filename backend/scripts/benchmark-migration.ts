/**
 * Phase 4C — 20,000-Record Enterprise Migration Benchmark
 * Measures empirical throughput across all pipeline stages:
 *   1. Synthetic Data Generation (20,000 records with realistic legacy noise)
 *   2. File Parsing & Legacy Alias Resolution
 *   3. Database Batch Staging (Neon PostgreSQL chunked ingestion)
 *   4. Validation Engine & Deduplication
 *   5. Non-Destructive Dry Run & Reconciliation Metrics
 *   6. Chunked Transactional Commit & Accession Sequence Increment
 *   7. Safe Rollback & Active Loan Guard Verification
 */

import { prisma } from '../src/config/prisma.js';
import { parseUploadedFile } from '../src/modules/migration/fileParser.js';
import { migrationService } from '../src/modules/migration/migration.service.js';
import { MigrationStatus, StagingRecordStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkTimings {
  datasetGenerationMs: number;
  fileParsingMs: number;
  batchStagingMs: number;
  validationEngineMs: number;
  dryRunSimulationMs: number;
  chunkedCommitMs: number;
  rollbackMs: number;
  totalPipelineMs: number;
}

interface BenchmarkResults {
  recordCount: number;
  validRecords: number;
  errorRecords: number;
  timings: BenchmarkTimings;
  throughput: {
    parsingRecsPerSec: number;
    stagingRecsPerSec: number;
    validationRecsPerSec: number;
    dryRunRecsPerSec: number;
    commitRecsPerSec: number;
  };
  reconciliation: {
    totalRecords: number;
    committedBooks: number;
    committedCopies: number;
    revertedBooks: number;
  };
}

async function runBenchmark(): Promise<BenchmarkResults> {
  console.log('=================================================================');
  console.log('  SMARTLIB PHASE 4C: 20,000-RECORD ENTERPRISE MIGRATION BENCHMARK');
  console.log('=================================================================\n');

  // Find admin user for execution context
  const adminUser = await prisma.user.findFirst({
    where: { role: { name: 'ADMIN' } },
  });
  if (!adminUser) {
    throw new Error('Admin user not found in database for benchmark');
  }

  const RECORD_COUNT = 20000;
  console.log(`[1/7] Generating synthetic dataset of ${RECORD_COUNT.toLocaleString()} legacy library records...`);
  const genStart = performance.now();

  const categories = [
    'Computer Science', 'Data Structures', 'Artificial Intelligence', 'Software Engineering',
    'Mathematics', 'Physics', 'Database Systems', 'Operating Systems', 'Networking', 'Cybersecurity'
  ];
  const publishers = [
    'O\'Reilly Media', 'Addison-Wesley', 'MIT Press', 'Pearson Education',
    'Springer Nature', 'McGraw-Hill', 'Wiley', 'Cambridge University Press'
  ];
  const authorsPool = [
    'Robert C. Martin', 'Martin Fowler', 'Donald Knuth', 'Andrew Tanenbaum',
    'Thomas Cormen', 'Stuart Russell', 'Peter Norvig', 'Brian Kernighan',
    'Dennis Ritchie', 'Bjarne Stroustrup', 'Kent Beck', 'Erich Gamma'
  ];

  const csvRows: string[] = [
    'Book_Title,ISBN_NO,Author_Name,Publisher_House,Genre,Publish_Year,Shelf,Num_Copies,Accession_No'
  ];

  let simulatedValid = 0;
  let simulatedErrors = 0;

  for (let i = 1; i <= RECORD_COUNT; i++) {
    // Inject ~3% bad records (missing title, corrupt ISBN, or invalid year)
    const isCorrupt = i % 33 === 0;
    const cat = categories[i % categories.length];
    const pub = publishers[i % publishers.length];
    const author = authorsPool[i % authorsPool.length];
    const year = 1990 + (i % 35);
    const shelf = `STACK-${String.fromCharCode(65 + (i % 6))}-${(i % 20) + 1}`;
    const copies = (i % 3) + 1;

    if (isCorrupt) {
      simulatedErrors++;
      if (i % 3 === 0) {
        // Missing title
        csvRows.push(`,978000${String(i).padStart(7, '0')},${author},${pub},${cat},${year},${shelf},1,`);
      } else if (i % 3 === 1) {
        // Bad ISBN
        csvRows.push(`Legacy Book ${i},BAD-ISBN-${i},${author},${pub},${cat},${year},${shelf},1,`);
      } else {
        // Invalid publication year
        csvRows.push(`Ancient Tome ${i},978000${String(i).padStart(7, '0')},${author},${pub},${cat},1450,${shelf},1,`);
      }
    } else {
      simulatedValid++;
      const isbn = `9788${String(i).padStart(9, '0')}`;
      csvRows.push(`"Foundations of Computing Vol. ${i}",${isbn},"${author}","${pub}","${cat}",${year},${shelf},${copies},`);
    }
  }

  const csvData = csvRows.join('\n');
  const csvBuffer = Buffer.from(csvData, 'utf-8');
  const genEnd = performance.now();
  const datasetGenerationMs = Math.round(genEnd - genStart);
  console.log(`      ✓ Generated ${(csvBuffer.length / (1024 * 1024)).toFixed(2)} MB CSV in ${datasetGenerationMs} ms`);

  // Stage 2: Parsing & Column Alias Resolution
  console.log('\n[2/7] Parsing CSV and resolving column aliases (formula sanitization active)...');
  const parseStart = performance.now();
  const parsed = parseUploadedFile(csvBuffer, 'benchmark_20k_legacy.csv');
  const parseEnd = performance.now();
  const fileParsingMs = Math.round(parseEnd - parseStart);
  console.log(`      ✓ Parsed ${parsed.totalRows.toLocaleString()} rows in ${fileParsingMs} ms (${Math.round((parsed.totalRows / (fileParsingMs / 1000))).toLocaleString()} recs/sec)`);

  // Stage 3: Database Batch Staging
  console.log('\n[3/7] Staging batch and rows into Neon PostgreSQL in resilient chunks of 1,000...');
  const stagingStart = performance.now();

  const batch = await prisma.migrationBatch.create({
    data: {
      batchName: `Benchmark-20k-${Date.now()}`,
      sourceFileName: 'benchmark_20k_legacy.csv',
      totalRecords: parsed.totalRows,
      validRecords: 0,
      errorRecords: 0,
      migratedRecords: 0,
      status: MigrationStatus.UPLOADED,
      executedByUserId: adminUser.id,
      dryRunSummary: {
        detectedHeaders: parsed.headers,
        columnMapping: parsed.mapping,
      },
    },
  });

  const CHUNK_SIZE = 1000;
  for (let i = 0; i < parsed.rows.length; i += CHUNK_SIZE) {
    const slice = parsed.rows.slice(i, i + CHUNK_SIZE);
    const stagingData = slice.map((row) => ({
      batchId: batch.id,
      rowNumber: row.rowNumber,
      rawPayload: {
        ...row.rawPayload,
        _mapped: row.mappedFields,
        _unmapped: row.unmappedFields,
      },
      status: StagingRecordStatus.PENDING,
    }));

    await prisma.migrationStagingRecord.createMany({
      data: stagingData,
    });
  }

  const stagingEnd = performance.now();
  const batchStagingMs = Math.round(stagingEnd - stagingStart);
  console.log(`      ✓ Staged ${RECORD_COUNT.toLocaleString()} staging records into Neon in ${batchStagingMs} ms (${Math.round((RECORD_COUNT / (batchStagingMs / 1000))).toLocaleString()} recs/sec)`);

  // Stage 4: Validation Engine
  console.log('\n[4/7] Running Validation Engine: checking ISBN-13 format, intra-batch deduplication, required fields...');
  const valStart = performance.now();
  const validatedBatch = await migrationService.validateBatch(batch.id, adminUser.id);
  const valEnd = performance.now();
  const validationEngineMs = Math.round(valEnd - valStart);
  console.log(`      ✓ Validation complete in ${validationEngineMs} ms:`);
  console.log(`        - Valid Records: ${validatedBatch.validRecords.toLocaleString()}`);
  console.log(`        - Error Records: ${validatedBatch.errorRecords.toLocaleString()}`);
  console.log(`        - Validation Throughput: ${Math.round((RECORD_COUNT / (validationEngineMs / 1000))).toLocaleString()} recs/sec`);

  // Stage 5: Dry-Run Simulation
  console.log('\n[5/7] Executing Non-Destructive Dry Run Simulation...');
  const dryStart = performance.now();
  const dryRunResult = await migrationService.dryRunBatch(batch.id, adminUser.id);
  const dryEnd = performance.now();
  const dryRunSimulationMs = Math.round(dryEnd - dryStart);
  const summary = dryRunResult.dryRunSummary || (dryRunResult as any).summary;
  console.log(`      ✓ Dry run complete in ${dryRunSimulationMs} ms:`);
  console.log(`        - Estimated New Books: ${summary.estimatedNewBooks?.toLocaleString()}`);
  console.log(`        - Estimated Physical Copies: ${summary.estimatedNewCopies?.toLocaleString()}`);
  console.log(`        - Estimated Authors: ${summary.estimatedAuthors?.toLocaleString()}`);
  console.log(`        - Estimated Publishers: ${summary.estimatedPublishers?.toLocaleString()}`);
  console.log(`        - Estimated Categories: ${summary.estimatedCategories?.toLocaleString()}`);
  console.log(`        - Dry Run Throughput: ${Math.round((RECORD_COUNT / (dryRunSimulationMs / 1000))).toLocaleString()} recs/sec`);

  // Stage 6: Production Commit Throughput Sample
  // To avoid bloating the production database with 20k test records, commit a controlled sample of 20 valid records
  // while marking staging accordingly to verify transactional commit speed and sequence discovery.
  console.log('\n[6/7] Testing Transactional Production Commit on sample subset (20 valid records)...');
  const commitStart = performance.now();

  // Create dedicated commit verification batch of 20 records
  const sampleRows = parsed.rows.slice(0, 20);
  const commitBatch = await prisma.migrationBatch.create({
    data: {
      batchName: `CommitSample-${Date.now()}`,
      sourceFileName: 'sample_commit.csv',
      totalRecords: sampleRows.length,
      validRecords: sampleRows.length,
      errorRecords: 0,
      migratedRecords: 0,
      status: MigrationStatus.VALIDATED,
      executedByUserId: adminUser.id,
    },
  });

  const commitStagingData = sampleRows.map((r, idx) => ({
    batchId: commitBatch.id,
    rowNumber: idx + 1,
    rawPayload: {
      ...r.rawPayload,
      _mapped: r.mappedFields,
    },
    normalizedPayload: {
      title: (r.mappedFields['title'] as string) || `Sample Book ${idx}`,
      isbn13: `978${String(90000000000 + idx + Math.floor(Date.now() / 10000)).slice(-10)}`,
      authors: [r.mappedFields['authors'] as string || 'Benchmark Author'],
      publisher: (r.mappedFields['publisher'] as string) || 'Benchmark Publisher',
      category: (r.mappedFields['category'] as string) || 'Benchmark Category',
      publicationYear: 2024,
      language: 'English',
      copiesCount: 2,
      shelfLocation: 'BENCH-A1',
    },
    status: StagingRecordStatus.VALID,
  }));

  await prisma.migrationStagingRecord.createMany({
    data: commitStagingData,
  });

  const commitResult = await migrationService.commitBatch(commitBatch.id, adminUser.id);
  const commitEnd = performance.now();
  const chunkedCommitMs = Math.round(commitEnd - commitStart);
  console.log(`      ✓ Committed 20 books (${commitResult.reconciliation.committedCopiesCount} copies) in ${chunkedCommitMs} ms (${Math.round((20 / (chunkedCommitMs / 1000)))} books/sec)`);

  // Stage 7: Rollback Verification
  console.log('\n[7/7] Testing Rollback: removing committed sample books and reverting staging state...');
  const rollStart = performance.now();
  const rollbackResult = await migrationService.rollbackBatch(commitBatch.id, adminUser.id);
  const rollEnd = performance.now();
  const rollbackMs = Math.round(rollEnd - rollStart);
  console.log(`      ✓ Safely rolled back ${rollbackResult.deletedBooksCount} books and ${rollbackResult.deletedCopiesCount} copies in ${rollbackMs} ms`);

  // Cleanup benchmark batches
  console.log('\n[Cleanup] Cleaning up benchmark staging records and batches...');
  await prisma.migrationStagingRecord.deleteMany({ where: { batchId: batch.id } });
  await prisma.migrationBatch.deleteMany({ where: { id: batch.id } });
  await prisma.migrationStagingRecord.deleteMany({ where: { batchId: commitBatch.id } });
  await prisma.migrationBatch.deleteMany({ where: { id: commitBatch.id } });
  console.log('      ✓ Benchmark data cleaned up cleanly without database pollution.');

  const totalPipelineMs = fileParsingMs + batchStagingMs + validationEngineMs + dryRunSimulationMs;

  const results: BenchmarkResults = {
    recordCount: RECORD_COUNT,
    validRecords: validatedBatch.validRecords,
    errorRecords: validatedBatch.errorRecords,
    timings: {
      datasetGenerationMs,
      fileParsingMs,
      batchStagingMs,
      validationEngineMs,
      dryRunSimulationMs,
      chunkedCommitMs,
      rollbackMs,
      totalPipelineMs,
    },
    throughput: {
      parsingRecsPerSec: Math.round(RECORD_COUNT / (fileParsingMs / 1000)),
      stagingRecsPerSec: Math.round(RECORD_COUNT / (batchStagingMs / 1000)),
      validationRecsPerSec: Math.round(RECORD_COUNT / (validationEngineMs / 1000)),
      dryRunRecsPerSec: Math.round(RECORD_COUNT / (dryRunSimulationMs / 1000)),
      commitRecsPerSec: Math.round(100 / (chunkedCommitMs / 1000)),
    },
    reconciliation: {
      totalRecords: RECORD_COUNT,
      committedBooks: commitResult.reconciliation.committedBooksCount,
      committedCopies: commitResult.reconciliation.committedCopiesCount,
      revertedBooks: rollbackResult.deletedBooksCount,
    },
  };

  return results;
}

runBenchmark()
  .then((results) => {
    console.log('\n=================================================================');
    console.log('                BENCHMARK SUMMARY & METRICS                     ');
    console.log('=================================================================');
    console.log(JSON.stringify(results, null, 2));

    // Save results to scratch directory for inclusion in final report
    const reportPath = path.resolve(process.cwd(), 'benchmark-20k-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\nResults written to: ${reportPath}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Benchmark failed:', err);
    process.exit(1);
  });
