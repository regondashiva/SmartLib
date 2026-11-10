import { PrismaClient, UserStatus, MemberType, MemberStatus, ItemStatus, ItemCondition, RFIDTagType, RFIDTagStatus, DeviceType, DeviceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SmartLib Database on Neon PostgreSQL...');

  // 1. Roles & Permissions
  const permissionsData = [
    { code: 'catalog:read', module: 'catalog', description: 'Browse and search catalog' },
    { code: 'catalog:create', module: 'catalog', description: 'Create bibliographic records' },
    { code: 'catalog:update', module: 'catalog', description: 'Modify bibliographic records' },
    { code: 'catalog:delete', module: 'catalog', description: 'Delete bibliographic records' },
    { code: 'circulation:issue', module: 'circulation', description: 'Issue book loans' },
    { code: 'circulation:return', module: 'circulation', description: 'Process book returns' },
    { code: 'circulation:renew', module: 'circulation', description: 'Extend loan durations' },
    { code: 'members:read', module: 'members', description: 'View member profiles' },
    { code: 'members:create', module: 'members', description: 'Register new patrons' },
    { code: 'members:update', module: 'members', description: 'Edit patron standing and details' },
    { code: 'rfid:encode', module: 'rfid', description: 'Encode and bind physical RFID tags' },
    { code: 'rfid:manage', module: 'rfid', description: 'Manage RFID hardware devices' },
    { code: 'inventory:audit', module: 'inventory', description: 'Execute handheld shelf audits' },
    { code: 'admin:users', module: 'admin', description: 'Manage staff accounts and roles' },
    { code: 'admin:audit', module: 'admin', description: 'Inspect system compliance audit logs' },
    { code: 'admin:config', module: 'admin', description: 'Modify institutional policies' },
  ];

  console.log('  -> Creating permissions...');
  for (const p of permissionsData) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  const allPermissions = await prisma.permission.findMany();

  console.log('  -> Creating roles...');
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'System Administrator with full institutional authority',
      isSystemRole: true,
    },
  });

  const librarianRole = await prisma.role.upsert({
    where: { name: 'LIBRARIAN' },
    update: {},
    create: {
      name: 'LIBRARIAN',
      description: 'Professional library staff managing circulation, catalog, and inventory',
      isSystemRole: true,
    },
  });

  const rfidOperatorRole = await prisma.role.upsert({
    where: { name: 'RFID_OPERATOR' },
    update: {},
    create: {
      name: 'RFID_OPERATOR',
      description: 'Technical operator managing tag encoding, gate monitors, and shelf audits',
      isSystemRole: true,
    },
  });

  await prisma.role.upsert({
    where: { name: 'STUDENT' },
    update: {},
    create: {
      name: 'STUDENT',
      description: 'Standard institutional student patron with catalog and loan visibility',
      isSystemRole: true,
    },
  });

  // Assign permissions to Admin & Librarian
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });

    // Assign non-admin permissions to Librarian
    if (!perm.code.startsWith('admin:')) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: librarianRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: librarianRole.id,
          permissionId: perm.id,
        },
      });
    }

    // Assign RFID permissions to RFID Operator
    if (perm.code.startsWith('rfid:') || perm.code.startsWith('inventory:') || perm.code === 'catalog:read') {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: rfidOperatorRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: rfidOperatorRole.id,
          permissionId: perm.id,
        },
      });
    }
  }

  // 2. Default Seed Users
  console.log('  -> Creating default institutional staff users...');
  const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@smartlib.institution.edu' },
    update: {},
    create: {
      email: 'admin@smartlib.institution.edu',
      passwordHash: adminPasswordHash,
      firstName: 'Chief',
      lastName: 'Administrator',
      roleId: adminRole.id,
      status: UserStatus.ACTIVE,
    },
  });

  const librarianPasswordHash = await bcrypt.hash('LibrarianPassword123!', 10);
  await prisma.user.upsert({
    where: { email: 'librarian@smartlib.institution.edu' },
    update: {},
    create: {
      email: 'librarian@smartlib.institution.edu',
      passwordHash: librarianPasswordHash,
      firstName: 'Eleanor',
      lastName: 'Vance',
      roleId: librarianRole.id,
      status: UserStatus.ACTIVE,
    },
  });

  // 3. Sample Categories & Publisher
  console.log('  -> Creating sample categories & publishers...');
  const catCS = await prisma.category.upsert({
    where: { name: 'Computer Science & Software Engineering' },
    update: {},
    create: {
      name: 'Computer Science & Software Engineering',
      code: 'DDC 004',
      description: 'Computing algorithms, software architecture, data structures',
    },
  });

  const publisherPrentice = await prisma.publisher.upsert({
    where: { name: 'Prentice Hall' },
    update: {},
    create: {
      name: 'Prentice Hall',
      website: 'https://www.pearson.com',
    },
  });

  const authorBob = await prisma.author.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Robert C. Martin',
      biography: 'Software craftsman and co-author of the Agile Manifesto.',
    },
  });

  // 4. Sample Bibliographic Master & Copies
  console.log('  -> Creating sample book titles & physical copies...');
  const cleanCodeBook = await prisma.book.upsert({
    where: { isbn13: '9780132350884' },
    update: {},
    create: {
      title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      subtitle: 'Best practices for writing readable, maintainable software',
      isbn13: '9780132350884',
      isbn10: '0132350882',
      edition: '1st Edition',
      publicationYear: 2008,
      language: 'English',
      pageCount: 464,
      callNumber: 'QA76.76.C66 M37 2008',
      categoryId: catCS.id,
      publisherId: publisherPrentice.id,
      authors: {
        create: {
          authorId: authorBob.id,
        },
      },
    },
  });

  // Create RFID Tags & Copies for Clean Code
  const tag1 = await prisma.rFIDTag.upsert({
    where: { epc: 'E2801160200078439A120001' },
    update: {},
    create: {
      epc: 'E2801160200078439A120001',
      tid: 'E280116020007843',
      tagType: RFIDTagType.UHF_EPC_GEN2,
      easArmed: true,
      status: RFIDTagStatus.ACTIVE,
      encodedAt: new Date(),
    },
  });

  const tag2 = await prisma.rFIDTag.upsert({
    where: { epc: 'E2801160200078439A120002' },
    update: {},
    create: {
      epc: 'E2801160200078439A120002',
      tid: 'E280116020007844',
      tagType: RFIDTagType.UHF_EPC_GEN2,
      easArmed: true,
      status: RFIDTagStatus.ACTIVE,
      encodedAt: new Date(),
    },
  });

  // Copy 1: Standard Circulating Copy (Available)
  await prisma.bookItem.upsert({
    where: { accessionNumber: 'ACC-2026-00001' },
    update: {},
    create: {
      bookId: cleanCodeBook.id,
      accessionNumber: 'ACC-2026-00001',
      barcode: 'BARC-00001',
      rfidTagId: tag1.id,
      status: ItemStatus.AVAILABLE,
      condition: ItemCondition.GOOD,
      shelfLocation: 'STACK-A/AISLE-02/SHELF-01',
      price: 49.99,
      isReferenceOnly: false,
    },
  });

  // Copy 2: Non-Circulating Reference Only Copy
  await prisma.bookItem.upsert({
    where: { accessionNumber: 'ACC-2026-00002' },
    update: {},
    create: {
      bookId: cleanCodeBook.id,
      accessionNumber: 'ACC-2026-00002',
      barcode: 'BARC-00002',
      rfidTagId: tag2.id,
      status: ItemStatus.REFERENCE_ONLY,
      condition: ItemCondition.NEW,
      shelfLocation: 'REF-ROOM/DESK-01',
      price: 65.00,
      isReferenceOnly: true,
    },
  });

  // 5. Sample Patron Member
  console.log('  -> Creating sample patron members...');
  await prisma.member.upsert({
    where: { cardNumber: 'STD-2026-1001' },
    update: {},
    create: {
      cardNumber: 'STD-2026-1001',
      smartCardUid: 'CARD-UID-9901A',
      firstName: 'Alex',
      lastName: 'Rivera',
      email: 'alex.rivera@student.institution.edu',
      phoneNumber: '+1-555-0199',
      memberType: MemberType.STUDENT,
      department: 'Computer Science',
      status: MemberStatus.ACTIVE,
      maxBorrowLimit: 4,
      fineBalance: 0.00,
      expiryDate: new Date('2027-06-30'),
    },
  });

  // 6. Sample RFID Devices
  console.log('  -> Registering RFID hardware devices...');
  await prisma.rFIDDevice.upsert({
    where: { deviceCode: 'STAFF-DESK-01' },
    update: {},
    create: {
      deviceCode: 'STAFF-DESK-01',
      name: 'Circulation Desk #1 Staff Station',
      deviceType: DeviceType.STAFF_STATION,
      ipAddress: '192.168.1.101',
      location: 'Ground Floor Circulation Desk',
      status: DeviceStatus.ONLINE,
      firmwareVersion: 'v2.4.1',
      lastHeartbeatAt: new Date(),
    },
  });

  await prisma.rFIDDevice.upsert({
    where: { deviceCode: 'GATE-MAIN-01' },
    update: {},
    create: {
      deviceCode: 'GATE-MAIN-01',
      name: 'Main Entrance Dual-Pedestal Security Gate',
      deviceType: DeviceType.SECURITY_GATE,
      ipAddress: '192.168.1.105',
      location: 'Library Main Portal',
      status: DeviceStatus.ONLINE,
      firmwareVersion: 'v3.1.0',
      lastHeartbeatAt: new Date(),
    },
  });

  console.log('✅ SmartLib Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

