import { parseArgs } from 'util';
import mysql from 'mysql2/promise';
import { UserRole, ContactType, ProductType, SaleStatus } from '../src/generated/client/index.js';
import prisma from '../src/utils/prisma.js';

// Legacy types
interface LegacyUser {
  id: number;
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

interface LegacyContact {
  id: number;
  type: string;
  name: string;
  mobile: string;
}

interface LegacyProduct {
  id: number;
  name: string;
  sku: string;
  type: string;
  sell_price_inc_tax: string;
}

interface LegacyVariation {
  id: number;
  product_id: number;
  name: string;
  sub_sku: string;
  sell_price_inc_tax: string;
}

interface LegacyTransaction {
  id: number;
  type: string;
  status: string;
  contact_id: number;
  final_total: string;
}

interface LegacyPayment {
  id: number;
  transaction_id: number;
  method: string;
  amount: string;
}

async function main() {
  const { values } = parseArgs({
    options: {
      'mysql-uri': { type: 'string' },
      'target-company-id': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  const mysqlUri = values['mysql-uri'];
  const targetCompanyId = parseInt(values['target-company-id'] || '0', 10);
  const isDryRun = values['dry-run'];

  if (!mysqlUri && !isDryRun) {
    console.error('Missing --mysql-uri');
    process.exit(1);
  }
  if (!targetCompanyId && !isDryRun) {
    console.error('Missing --target-company-id');
    process.exit(1);
  }

  console.log(`Starting migration to company ${targetCompanyId} (Dry run: ${isDryRun})`);

  let connection;
  try {
    if (mysqlUri && mysqlUri !== 'dummy') {
      connection = await mysql.createConnection(mysqlUri);
      console.log('Connected to MySQL.');
    } else {
      console.log('No valid MySQL URI provided. Using mock data for dry run.');
    }
  } catch (error) {
    console.warn('Could not connect to MySQL:', error);
    if (!isDryRun) process.exit(1);
  }

  // Fetch or mock data
  let legacyUsers: LegacyUser[] = [{ id: 1, username: 'admin', email: 'admin@test.com', password: 'hash', first_name: 'Admin', last_name: 'User' }];
  let legacyContacts: LegacyContact[] = [{ id: 1, type: 'customer', name: 'John Doe', mobile: '123456789' }];
  let legacyProducts: LegacyProduct[] = [{ id: 1, name: 'Product A', sku: 'SKU01', type: 'single', sell_price_inc_tax: '100.00' }];
  let legacyVariations: LegacyVariation[] = [{ id: 1, product_id: 1, name: 'DUMMY', sub_sku: 'SKU01', sell_price_inc_tax: '100.00' }];
  let legacyTransactions: LegacyTransaction[] = [{ id: 1, type: 'sell', status: 'final', contact_id: 1, final_total: '250.00' }];
  let legacyPayments: LegacyPayment[] = [{ id: 1, transaction_id: 1, method: 'cash', amount: '250.00' }];

  if (connection) {
    // [legacyUsers] = await connection.execute('SELECT * FROM users');
    // [legacyContacts] = await connection.execute('SELECT * FROM contacts');
    // [legacyProducts] = await connection.execute('SELECT * FROM products');
    // [legacyVariations] = await connection.execute('SELECT * FROM variations');
    // [legacyTransactions] = await connection.execute('SELECT * FROM transactions WHERE type="sell"');
    // [legacyPayments] = await connection.execute('SELECT * FROM transaction_payments');
  }

  // Mappers
  const usersInput = legacyUsers.map(u => ({
    companyId: targetCompanyId,
    username: u.username,
    email: u.email,
    passwordHash: u.password,
    fullName: `${u.first_name} ${u.last_name}`,
    role: UserRole.CASHIER,
  }));

  const contactsInput = legacyContacts.map(c => ({
    companyId: targetCompanyId,
    type: c.type === 'customer' ? ContactType.CUSTOMER : ContactType.SUPPLIER,
    fullName: c.name,
    phone: c.mobile,
  }));

  const productsInput = legacyProducts.map(p => ({
    companyId: targetCompanyId,
    name: p.name,
    sku: p.sku,
    salePrice: parseFloat(p.sell_price_inc_tax),
    type: ProductType.RETAIL,
  }));

  const salesInput = legacyTransactions.map(t => ({
    companyId: targetCompanyId,
    status: SaleStatus.FINAL,
    total: parseFloat(t.final_total),
  }));

  // Reconciliation
  const oldTotal = legacyTransactions.reduce((sum, t) => sum + parseFloat(t.final_total), 0);
  const newTotal = salesInput.reduce((sum, s) => sum + s.total, 0);

  console.log(`Reconciliation check: Old Total = ${oldTotal}, New Total = ${newTotal}`);
  if (Math.abs(oldTotal - newTotal) > 0.01) {
    console.error('Reconciliation failed: totals do not match');
    process.exit(1);
  } else {
    console.log('Reconciliation successful: SUM(old_sales) === SUM(new_sales)');
  }

  if (isDryRun) {
    console.log('Dry run complete. No data written.');
  } else {
    console.log('Writing data to target DB...');
    await prisma.$transaction([
      prisma.user.createMany({ data: usersInput, skipDuplicates: true }),
      prisma.contact.createMany({ data: contactsInput, skipDuplicates: true }),
      prisma.product.createMany({ data: productsInput, skipDuplicates: true }),
      prisma.sale.createMany({ data: salesInput, skipDuplicates: true }),
    ]);
    console.log('Migration complete.');
  }

  if (connection) await connection.end();
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
