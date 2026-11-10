const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function check() {
  const prisma = new PrismaClient();
  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`[Target DB Host] ${u.host}`);
    console.log(`[Target DB Name] ${u.pathname}`);

    const schemas = await prisma.$queryRawUnsafe(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema')"
    );
    console.log('[Existing Schemas]', schemas);

    const counts = {
      users: await prisma.user.count(),
      books: await prisma.book.count(),
      bookItems: await prisma.bookItem.count(),
      members: await prisma.member.count(),
      circulations: await prisma.circulation.count(),
    };
    console.log('[Current Baseline Counts]', counts);
  } catch (err) {
    console.error('Error connecting to database:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();

