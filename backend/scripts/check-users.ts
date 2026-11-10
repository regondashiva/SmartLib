import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    select: { email: true, status: true, role: { select: { name: true } } },
  });
  console.log('NEON_USERS_FOUND:', JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

check();

