import { PrismaClient, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedAcInUsers() {
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const librarianRole = await prisma.role.findUnique({ where: { name: 'LIBRARIAN' } });

  if (!adminRole || !librarianRole) {
    console.error('Roles not found!');
    process.exit(1);
  }

  const adminHash = await bcrypt.hash('Admin@SmartLib2026!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@smartlib.ac.in' },
    update: { passwordHash: adminHash, status: UserStatus.ACTIVE },
    create: {
      email: 'admin@smartlib.ac.in',
      passwordHash: adminHash,
      firstName: 'Institutional',
      lastName: 'Administrator',
      roleId: adminRole.id,
      status: UserStatus.ACTIVE,
    },
  });

  const libHash = await bcrypt.hash('Lib@SmartLib2026!', 10);
  await prisma.user.upsert({
    where: { email: 'librarian@smartlib.ac.in' },
    update: { passwordHash: libHash, status: UserStatus.ACTIVE },
    create: {
      email: 'librarian@smartlib.ac.in',
      passwordHash: libHash,
      firstName: 'Chief',
      lastName: 'Librarian',
      roleId: librarianRole.id,
      status: UserStatus.ACTIVE,
    },
  });

  console.log('Successfully added admin@smartlib.ac.in and librarian@smartlib.ac.in to Neon!');
  await prisma.$disconnect();
}

seedAcInUsers();

