import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/client/index.js';
import bcrypt from 'bcrypt';

const connectionString = process.env.TAYSRPOS_DATABASE_URL
  || 'postgresql://admin:adminpassword@localhost:5432/taysrpos_dev';

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log('Seeding TaysrPOS dev database...');

  // 1. Create demo company
  const company = await prisma.company.upsert({
    where: { accountId: 'pos-v0-demo' },
    update: {},
    create: {
      accountId: 'pos-v0-demo',
      name: 'TaysrPOS Demo',
      legalName: 'TaysrPOS Demo SARL',
      city: 'Casablanca',
      restaurantEnabled: false,
    },
  });
  console.log(`  Company: ${company.name} (id=${company.id})`);

  // 2. Create users with password + PIN
  const users = [
    { username: 'admin',   fullName: 'Admin Principal',   role: 'ADMIN'   as const, password: 'admin123',   pin: '1111' },
    { username: 'manager', fullName: 'Gérant Magasin',    role: 'MANAGER' as const, password: 'manager123', pin: '2222' },
    { username: 'cashier', fullName: 'Caisse Principale', role: 'CASHIER' as const, password: 'cashier123', pin: '3333' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { companyId_username: { companyId: company.id, username: u.username } },
      update: {
        passwordHash: await bcrypt.hash(u.password, 10),
        pinHash: await bcrypt.hash(u.pin, 10),
      },
      create: {
        companyId: company.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        passwordHash: await bcrypt.hash(u.password, 10),
        pinHash: await bcrypt.hash(u.pin, 10),
      },
    });
    console.log(`  User: ${u.fullName} (${u.username} / ${u.password}, PIN: ${u.pin})`);
  }

  // 3. Create default location + warehouse
  await prisma.location.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Magasin Principal' } },
    update: {},
    create: { companyId: company.id, name: 'Magasin Principal' },
  });

  await prisma.warehouse.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Stock Principal' } },
    update: {},
    create: { companyId: company.id, name: 'Stock Principal', isActive: true },
  });

  console.log('  Location + Warehouse created');
  console.log('Seed complete!');
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
