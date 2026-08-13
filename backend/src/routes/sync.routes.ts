import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { DeviceRequest } from '../middleware/auth.js';
import { PaymentMethod, PaymentStatus, SaleChannel, SaleStatus } from '../generated/client/index.js';
import { getOrCreateCashAccount, postCashTransaction } from '../utils/accounting.js';

const router = Router();

// ── POST /sync/batch ──────────────────────────────────────────────────────
// Only entity_type "sale" / operation "create" is actually sent by Hanout
// Express today (its CustomerRepository never enqueues a sync event - credit
// payments taken on-device are local-only there, a gap flagged back to that
// app's maintainer, not something fixable from this side). Any other
// combination is accepted at the HTTP level but reported back in failed_ids
// rather than silently dropped or pretend-succeeded, so a future Hanout
// build that starts sending "customer"/"payment" events fails loudly instead
// of quietly losing data.

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

const ingestSale = async (companyId: number, locationId: number, raw: unknown) => {
  const data = saleEventPayloadSchema.parse(raw);

  const existing = await prisma.sale.findUnique({ where: { externalId: data.id } });
  if (existing) return; // already synced from a previous (retried) batch

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
      const existingStock = await tx.productStock.findFirst({
        where: { productId: product.id, warehouseId: warehouse!.id, variationId: null },
      });
      if (existingStock) {
        await tx.productStock.update({ where: { id: existingStock.id }, data: { quantity: { decrement: item.qty } } });
      } else {
        await tx.productStock.create({ data: { productId: product.id, warehouseId: warehouse!.id, quantity: -item.qty } });
      }
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

router.post('/batch', async (req: DeviceRequest, res, next) => {
  try {
    const data = batchSchema.parse(req.body);
    const { companyId, locationId } = req.device!;

    const successIds: string[] = [];
    const failedIds: string[] = [];

    for (const event of data.events) {
      try {
        if (event.entity_type !== 'sale' || event.operation !== 'create') {
          failedIds.push(event.event_id);
          continue;
        }
        await ingestSale(companyId, locationId, event.payload);
        successIds.push(event.event_id);
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
// Deliberately thin - Hanout's own DTOs only carry {id, name, price, barcode}
// for products and {id, name, phone, balance} for customers. No stock, tax,
// or category data requested by the client; don't invent a richer payload.

router.get('/pull', async (req: DeviceRequest, res, next) => {
  try {
    const { companyId } = req.device!;
    const lastSync = Number(req.query.last_sync) || 0;
    const since = new Date(lastSync);

    const [products, customers] = await Promise.all([
      prisma.product.findMany({
        where: { companyId, isActive: true, ...(lastSync ? { updatedAt: { gte: since } } : {}) },
        select: { id: true, name: true, salePrice: true, barcode: true },
      }),
      prisma.contact.findMany({
        where: { companyId, type: 'CUSTOMER', isActive: true, ...(lastSync ? { updatedAt: { gte: since } } : {}) },
        select: { id: true, fullName: true, phone: true, balance: true },
      }),
    ]);

    res.json({
      products: products.map(p => ({ id: String(p.id), name: p.name, price: Number(p.salePrice), barcode: p.barcode })),
      // Sign flip: v0's Contact.balance is positive when the customer owes
      // the store (a receivable). Hanout's own convention (its README) is the
      // opposite - negative means the customer owes money. Getting this wrong
      // would show every debtor as having credit and vice versa.
      customers: customers.map(c => ({ id: String(c.id), name: c.fullName, phone: c.phone, balance: -Number(c.balance) })),
      config: null,
      server_time: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
