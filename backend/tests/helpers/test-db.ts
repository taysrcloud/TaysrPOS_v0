import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDefaultPrisma } from '../../src/utils/prisma.js';
import { JWT_SECRET } from '../../src/config.js';
import { UserRole } from '../../src/generated/client/index.js';

const prisma = getDefaultPrisma();

export interface TestTenantContext {
  marker: string;
  company: { id: number; accountId: string | null; name: string };
  users: Record<UserRole, { id: number; username: string; token: string }>;
  location: { id: number; name: string };
  warehouse: { id: number; name: string };
  customer: { id: number; fullName: string };
  supplier: { id: number; fullName: string };
  product: { id: number; name: string; sku: string; price: number };
}

export async function createTestTenant(suffix: string): Promise<TestTenantContext> {
  const marker = `test-${Date.now()}-${suffix}-${Math.floor(Math.random() * 1000)}`;
  
  const company = await prisma.company.create({
    data: {
      accountId: `ACC-${marker}`,
      name: `Tenant ${suffix} ${marker}`,
      ice: '001234567000089',
      ifNumber: '12345678',
      rc: '98765',
      defaultCurrency: 'MAD',
      defaultTvaRate: 20,
    },
  });

  const passwordHash = await bcrypt.hash('TestPass123!', 4);
  const roles: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.USER];
  const users: Partial<Record<UserRole, { id: number; username: string; email: string; fullName: string; token: string }>> = {};

  for (const role of roles) {
    const username = `${role.toLowerCase()}-${marker}`;
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        username,
        email: `${username}@test.local`,
        passwordHash,
        fullName: `User ${role} ${suffix}`,
        role,
        isActive: true,
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        companyId: company.id,
        role: user.role,
        accountId: company.accountId,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    users[role] = { id: user.id, username: user.username, email: user.email!, fullName: user.fullName, token };
  }

  const location = await prisma.location.create({
    data: { companyId: company.id, name: `Magasin ${suffix} ${marker}`, isActive: true },
  });

  const warehouse = await prisma.warehouse.create({
    data: { companyId: company.id, locationId: location.id, name: `Stock ${suffix} ${marker}`, isMain: true, isActive: true },
  });

  const customer = await prisma.contact.create({
    data: { companyId: company.id, fullName: `Client ${suffix} ${marker}`, type: 'CUSTOMER', isActive: true },
  });

  const supplier = await prisma.contact.create({
    data: { companyId: company.id, fullName: `Fournisseur ${suffix} ${marker}`, type: 'SUPPLIER', isActive: true },
  });

  const product = await prisma.product.create({
    data: {
      companyId: company.id,
      name: `Article ${suffix} ${marker}`,
      sku: `SKU-${marker}`,
      salePrice: 100,
      purchasePrice: 60,
      tvaRate: 20,
      trackStock: true,
      isActive: true,
    },
  });

  await prisma.productStock.create({
    data: { productId: product.id, warehouseId: warehouse.id, quantity: 50 },
  });

  return {
    marker,
    company: { id: company.id, accountId: company.accountId, name: company.name },
    users: users as Record<UserRole, { id: number; username: string; token: string }>,
    location: { id: location.id, name: location.name },
    warehouse: { id: warehouse.id, name: warehouse.name },
    customer: { id: customer.id, fullName: customer.fullName },
    supplier: { id: supplier.id, fullName: supplier.fullName },
    product: { id: product.id, name: product.name, sku: product.sku, price: 100 },
  };
}

export async function cleanupTestTenant(tenant: TestTenantContext): Promise<void> {
  const companyId = tenant.company.id;
  
  // Clean in FK-dependent order
  await prisma.attendance.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.dashboardConfiguration.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.documentAndNote.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.notificationTemplate.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.userPermission.deleteMany({ where: { user: { companyId } } }).catch(() => {});
  await prisma.payment.deleteMany({ where: { sale: { companyId } } }).catch(() => {});
  await prisma.saleItem.deleteMany({ where: { sale: { companyId } } }).catch(() => {});
  await prisma.sale.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.purchaseItem.deleteMany({ where: { purchase: { companyId } } }).catch(() => {});
  await prisma.purchase.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.invoiceLine.deleteMany({ where: { invoice: { companyId } } }).catch(() => {});
  await prisma.invoice.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.consolidatedInvoice.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.cashMovement.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.cashRegisterSession.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.accountTransaction.deleteMany({ where: { account: { companyId } } }).catch(() => {});
  await prisma.account.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.accountType.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.expense.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.productStock.deleteMany({ where: { product: { companyId } } }).catch(() => {});
  await prisma.stockMovement.deleteMany({ where: { product: { companyId } } }).catch(() => {});
  await prisma.productGroupPrice.deleteMany({ where: { product: { companyId } } }).catch(() => {});
  await prisma.productVariation.deleteMany({ where: { product: { companyId } } }).catch(() => {});
  await prisma.product.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.discount.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.variationTemplate.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.warranty.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.currency.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.device.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.salesCommissionAgent.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.contact.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.customerGroup.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.sellingPriceGroup.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.taxRate.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.warehouse.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.location.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.unit.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.brand.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.category.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
}
