import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { DeviceRequest } from '../middleware/auth.js';
import { ContactType, PaymentMethod, PaymentStatus, SaleChannel, SaleStatus } from '../generated/client/index.js';
import { getOrCreateCashAccount, postCashTransaction } from '../utils/accounting.js';
import { adjustProductStock } from '../utils/stock.js';

const router = Router();

// ── Schemas for Sync Events ───────────────────────────────────────────────

const saleEventPayloadSchema = z.object({
  id: z.string().min(1),
  total: z.coerce.number(),
  subtotal: z.coerce.number(),
  discount: z.coerce.number().default(0),
  paymentMethod: z.enum(['CASH', 'CARD', 'CREDIT']),
  customerId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  ticketNumber: z.union([z.string(), z.number()]),
  createdAt: z.coerce.number(),
  items: z.array(z.object({
    productId: z.string().min(1),
    qty: z.coerce.number().positive(),
    unitPrice: z.coerce.number(),
  })).min(1),
});

const customerEventPayloadSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

const paymentEventPayloadSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(['CASH', 'CARD']).default('CASH'),
  createdAt: z.coerce.number().optional(),
});

const eventSchema = z.object({
  event_id: z.string().min(1),
  entity_type: z.string(),
  operation: z.string(),
  payload: z.unknown(),
});

const batchSchema = z.object({
  device_id: z.string().min(1),
  events: z.array(eventSchema),
});

// ── Ingestion Handlers ───────────────────────────────────────────────────

const ingestSale = async (companyId: number, locationId: number, raw: unknown) => {
  const data = saleEventPayloadSchema.parse(raw);

  const existing = await prisma.sale.findUnique({ where: { externalId: data.id } });
  if (existing) return;

  let warehouse = await prisma.warehouse.findFirst({ where: { companyId, locationId } });
  if (!warehouse) warehouse = await prisma.warehouse.findFirst({ where: { companyId } });
  if (!warehouse) throw new Error('NO_WAREHOUSE');

  const productIds = [...new Set(data.items.map(item => Number(item.productId)))];
  if (productIds.some(id => !Number.isInteger(id))) throw new Error('BAD_PRODUCT_ID');
  const products = await prisma.product.findMany({ where: { companyId, id: { in: productIds } } });
  if (products.length !== productIds.length) throw new Error('PRODUCT_NOT_FOUND');
  const productMap = new Map(products.map(p => [p.id, p]));

  let customerId: number | undefined;
  if (data.customerId) {
    const parsed = Number(data.customerId);
    if (!Number.isInteger(parsed)) throw new Error('BAD_CUSTOMER_ID');
    const customer = await prisma.contact.findFirst({ where: { id: parsed, companyId } });
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND');
    customerId = customer.id;
  }
  if (!customerId && data.paymentMethod === 'CREDIT') throw new Error('CREDIT_NEEDS_CUSTOMER');

  const taxTotal = Math.max(0, data.total - (data.subtotal - data.discount));

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        companyId,
        locationId,
        customerId,
        channel: SaleChannel.RETAIL,
        status: SaleStatus.FINAL,
        paymentStatus: data.paymentMethod === 'CREDIT' ? PaymentStatus.UNPAID : PaymentStatus.PAID,
        externalId: data.id,
        ticketNumber: `HXP-${data.ticketNumber}`,
        subtotal: data.subtotal,
        discountTotal: data.discount,
        taxTotal,
        total: data.total,
        finalizedAt: new Date(data.createdAt),
        items: {
          create: data.items.map(item => ({
            productId: Number(item.productId),
            quantity: item.qty,
            unitPrice: item.unitPrice,
            lineTotal: item.qty * item.unitPrice,
          })),
        },
      },
    });

    if (data.paymentMethod === 'CREDIT') {
      await tx.contact.update({ where: { id: customerId! }, data: { balance: { increment: data.total } } });
    } else {
      await tx.payment.create({
        data: { saleId: sale.id, method: data.paymentMethod as PaymentMethod, amount: data.total, reference: data.id },
      });
      const account = await getOrCreateCashAccount(tx, companyId, locationId);
      await postCashTransaction(tx, account, 'DEBIT', data.total, `SALE-${sale.id}`, sale.ticketNumber ?? undefined);
    }

    for (const item of data.items) {
      const product = productMap.get(Number(item.productId))!;
      if (!product.trackStock) continue;
      await adjustProductStock(tx, product.id, warehouse!.id, null, -item.qty);
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          warehouseId: warehouse!.id,
          type: 'OUT',
          quantity: item.qty,
          reference: sale.ticketNumber,
          notes: 'Vente Hanout Express',
        },
      });
    }
  });
};

const ingestCustomer = async (companyId: number, raw: unknown) => {
  const data = customerEventPayloadSchema.parse(raw);
  const parsedId = data.id ? Number(data.id) : undefined;

  if (parsedId && Number.isInteger(parsedId)) {
    const existing = await prisma.contact.findFirst({ where: { id: parsedId, companyId } });
    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          fullName: data.name,
          phone: data.phone || existing.phone,
          email: data.email || existing.email,
          address: data.address || existing.address,
        },
      });
      return;
    }
  }

  await prisma.contact.create({
    data: {
      companyId,
      type: ContactType.CUSTOMER,
      fullName: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    },
  });
};

const ingestPayment = async (companyId: number, locationId: number, raw: unknown) => {
  const data = paymentEventPayloadSchema.parse(raw);
  const customerId = Number(data.customerId);
  if (!Number.isInteger(customerId)) throw new Error('BAD_CUSTOMER_ID');

  const customer = await prisma.contact.findFirst({ where: { id: customerId, companyId } });
  if (!customer) throw new Error('CUSTOMER_NOT_FOUND');

  await prisma.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: customer.id },
      data: { balance: { decrement: data.amount } },
    });

    const account = await getOrCreateCashAccount(tx, companyId, locationId);
    await postCashTransaction(
      tx,
      account,
      'DEBIT',
      data.amount,
      `PAYMENT-${data.id}`,
      `Règlement client: ${customer.fullName}`
    );
  });
};

// ── POST /sync/batch ──────────────────────────────────────────────────────

router.post('/batch', async (req: DeviceRequest, res, next) => {
  try {
    const data = batchSchema.parse(req.body);
    const { companyId, locationId } = req.device!;

    const successIds: string[] = [];
    const failedIds: string[] = [];

    for (const event of data.events) {
      try {
        if (event.entity_type === 'sale' && event.operation === 'create') {
          await ingestSale(companyId, locationId, event.payload);
          successIds.push(event.event_id);
        } else if (event.entity_type === 'customer' && (event.operation === 'create' || event.operation === 'update')) {
          await ingestCustomer(companyId, event.payload);
          successIds.push(event.event_id);
        } else if (event.entity_type === 'payment' && event.operation === 'create') {
          await ingestPayment(companyId, locationId, event.payload);
          successIds.push(event.event_id);
        } else {
          failedIds.push(event.event_id);
        }
      } catch (err) {
        failedIds.push(event.event_id);
      }
    }

    res.json({ success_ids: successIds, failed_ids: failedIds, conflicts: [] });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid batch payload' });
    next(error);
  }
});

// ── GET /sync/pull ────────────────────────────────────────────────────────

router.get('/pull', async (req: DeviceRequest, res, next) => {
  try {
    const { companyId } = req.device!;
    const lastSync = Number(req.query.last_sync) || 0;
    const since = new Date(lastSync);

    const [products, customers, deletedProducts, deletedCustomers] = await Promise.all([
      prisma.product.findMany({
        where: { companyId, isActive: true, ...(lastSync ? { updatedAt: { gte: since } } : {}) },
        select: {
          id: true,
          name: true,
          salePrice: true,
          barcode: true,
          categoryId: true,
          tvaRate: true,
          stocks: { select: { quantity: true } },
          variations: { select: { id: true, name: true, sku: true, salePrice: true } },
        },
      }),
      prisma.contact.findMany({
        where: { companyId, type: 'CUSTOMER', isActive: true, ...(lastSync ? { updatedAt: { gte: since } } : {}) },
        select: { id: true, fullName: true, phone: true, balance: true, creditLimit: true, customerGroupId: true },
      }),
      lastSync
        ? prisma.product.findMany({
            where: { companyId, isActive: false, updatedAt: { gte: since } },
            select: { id: true },
          })
        : Promise.resolve([]),
      lastSync
        ? prisma.contact.findMany({
            where: { companyId, type: 'CUSTOMER', isActive: false, updatedAt: { gte: since } },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    res.json({
      products: products.map((p) => ({
        id: String(p.id),
        name: p.name,
        price: Number(p.salePrice),
        barcode: p.barcode,
        categoryId: p.categoryId,
        taxRate: p.tvaRate ? Number(p.tvaRate) : 0,
        stockQuantity: p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0),
        variations: p.variations.map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.salePrice ? Number(v.salePrice) : Number(p.salePrice),
        })),
      })),
      customers: customers.map((c) => ({
        id: String(c.id),
        name: c.fullName,
        phone: c.phone,
        balance: -Number(c.balance),
        creditLimit: c.creditLimit ? Number(c.creditLimit) : null,
        customerGroupId: c.customerGroupId,
      })),
      deleted_ids: [
        ...deletedProducts.map((p) => `product_${p.id}`),
        ...deletedCustomers.map((c) => `customer_${c.id}`),
      ],
      config: null,
      server_time: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
