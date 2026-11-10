import { prisma } from '../src/config/prisma.js';

async function main() {
  const deletedStaging = await prisma.migrationStagingRecord.deleteMany({
    where: { batch: { batchName: { startsWith: 'Benchmark-20k' } } },
  });
  const deletedBatches = await prisma.migrationBatch.deleteMany({
    where: { batchName: { startsWith: 'Benchmark-20k' } },
  });
  console.log(`Cleaned up ${deletedBatches.count} batches and ${deletedStaging.count} staging records.`);
  await prisma.$disconnect();
}

main().catch(console.error);

