import { requireAuth } from '../middleware/auth.js';
import { Router } from 'express';
import { z } from 'zod';
import { PaymentMethod, PaymentStatus, ProductType, SaleChannel, SaleStatus } from '../generated/client/index.js';
import { prisma } from '../utils/prisma.js';

const router = Router();

const demoCatalog = new Map([
  [1, { name: 'Bouteille eau 50cl', sku: 'EAU-050', salePrice: 6, tvaRate: 20 }],
  [2, { name: 'Riz 5kg', sku: 'RIZ-005', salePrice: 58, tvaRate: 20 }],
  [3, { name: 'Recharge mobile', sku: 'SRV-RECHARGE', salePrice: 20, tvaRate: 0 }],
]);

const saleSchema = z.object({
  customerName: z.string().trim().optional().default('Client comptoir'),
  method: z.enum(['CASH', 'CARD', 'CREDIT', 'MULTI']).default('CASH'),
  status: z.enum(['FINAL', 'DRAFT', 'SUSPENDED', 'QUOTE']).default('FINAL'),
  discountRate: z.coerce.number().min(0).max(100).default(0),
  locationId: z.coerce.number().int().positive().optional(),
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().positive(),
    discount: z.coerce.number().min(0).default(0),
  })).min(1),
});

const asNumber = (value: unknown) => value && typeof value === 'object' && 'toNumber' in value
  ? (value as { toNumber: () => number }).toNumber()
  : Number(value || 0);


const mapMethod = (method: z.infer<typeof saleSchema>['method']): PaymentMethod => {
  if (method === 'MULTI') return PaymentMethod.MIXED;
  return method as PaymentMethod;
};

const statusLabel = (sale: any) => {
  if (sale.status === SaleStatus.SUSPENDED) return 'Suspendue';
  if (sale.status === SaleStatus.DRAFT && sale.note === 'DEVIS') return 'Devis';
  if (sale.status === SaleStatus.DRAFT) return 'Brouillon';
  if (sale.paymentStatus === PaymentStatus.UNPAID) return 'Credit';
  return 'Payee';
};

const methodLabel = (sale: any) => {
  const method = sale.payments?.[0]?.method;
  if (method === PaymentMethod.CASH) return 'CASH';
  if (method === PaymentMethod.CARD) return 'CARD';
  if (method === PaymentMethod.CREDIT) return 'CREDIT';
  if (method === PaymentMethod.MIXED) return 'MULTI';
  return sale.paymentStatus === PaymentStatus.UNPAID ? 'CREDIT' : 'CASH';
};

const normalizeSale = (sale: any) => ({
  id: sale.id,
    customerId: sale.customerId,
    invoiceId: sale.invoiceId,
  ticket: sale.ticketNumber || `TCK-${String(sale.id).padStart(4, '0')}`,
  customer: sale.customer?.fullName || 'Client comptoir',
  total: asNumber(sale.total),
  subtotal: asNumber(sale.subtotal),
  taxTotal: asNumber(sale.taxTotal),
  discountTotal: asNumber(sale.discountTotal),
  items: sale.items?.reduce((sum: number, item: any) => sum + asNumber(item.quantity), 0) || 0,
  method: methodLabel(sale),
  status: statusLabel(sale),
  createdAt: sale.createdAt ? new Date(sale.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Maintenant',
  lines: sale.items?.map((item: any) => ({
    productId: item.productId,
    name: item.product?.name || 'Produit',
    sku: item.product?.sku || '',
    quantity: asNumber(item.quantity),
    unitPrice: asNumber(item.unitPrice),
    discount: asNumber(item.discount),
    tvaRate: asNumber(item.tvaRate),
    lineTotal: asNumber(item.lineTotal),
  })) || [],
});

router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const companyId = req.user.companyId;
    const company = { id: companyId };
    const sales = await prisma.sale.findMany({
      where: { companyId: company.id },
      include: { customer: true, payments: true, items: { include: { product: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 80,
    });
    res.json({ sales: sales.map(normalizeSale) });
  } catch (error) {
    console.error('Sales list error:', error);
    res.status(200).json({ sales: [], message: 'Base de donnees indisponible: ventes locales uniquement' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = saleSchema.parse(req.body);
    const company = await prisma.company.findFirst();
    if (!company) return res.status(400).json({ message: 'No company found' });

    let location = await prisma.location.findFirst({
      where: data.locationId ? { id: data.locationId, companyId: company.id } : { companyId: company.id }
    });
    if (!location) return res.status(400).json({ message: 'Location not found' });

    let warehouse = await prisma.warehouse.findFirst({
      where: { companyId: company.id, locationId: location.id }
    });
    if (!warehouse) {
      warehouse = await prisma.warehouse.findFirst({ where: { companyId: company.id } });
    }
    if (!warehouse) return res.status(400).json({ message: 'Warehouse not found' });

    const productIds = data.items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { companyId: company.id, id: { in: productIds }, isActive: true },
      include: { stocks: { where: { warehouseId: warehouse.id } }, variations: true },
    });
    if (products.length !== productIds.length) return res.status(400).json({ message: 'Un produit du panier est introuvable' });

    const productMap = new Map(products.map(product => [product.id, product]));
    const rawLines = data.items.map(item => {
      const product = productMap.get(item.productId)!;
      const unitPrice = asNumber(product.salePrice);
      const tvaRate = asNumber(product.tvaRate);
      const lineNet = Math.max(0, (unitPrice - item.discount) * item.quantity);
      const lineTax = lineNet * tvaRate / 100;
      return { item, product, unitPrice, tvaRate, lineNet, lineTax, lineTotal: lineNet + lineTax };
    });
    const subtotal = rawLines.reduce((sum, line) => sum + line.unitPrice * line.item.quantity, 0);
    const lineDiscount = rawLines.reduce((sum, line) => sum + line.item.discount * line.item.quantity, 0);
    const orderDiscount = Math.max(0, subtotal - lineDiscount) * data.discountRate / 100;
    const discountTotal = lineDiscount + orderDiscount;
    const taxTotal = rawLines.reduce((sum, line) => sum + line.lineTax, 0);
    const total = Math.max(0, subtotal - discountTotal + taxTotal);
    const shouldFinalize = data.status === 'FINAL';
    const saleStatus = data.status === 'SUSPENDED' ? SaleStatus.SUSPENDED : data.status === 'FINAL' ? SaleStatus.FINAL : SaleStatus.DRAFT;
    const paymentStatus = !shouldFinalize ? PaymentStatus.UNPAID : data.method === 'CREDIT' ? PaymentStatus.UNPAID : PaymentStatus.PAID;

    const sale = await prisma.$transaction(async (tx) => {
      const customerName = data.customerName || 'Client comptoir';
      const customer = customerName === 'Client comptoir'
        ? null
        : await tx.contact.create({ data: { companyId: company.id, type: 'CUSTOMER', fullName: customerName } });

      const created = await tx.sale.create({
        data: {
          companyId: company.id,
          locationId: location.id,
          customerId: customer?.id,
          channel: SaleChannel.RETAIL,
          status: saleStatus,
          paymentStatus,
          ticketNumber: `TCK-${Date.now().toString().slice(-7)}`,
          note: data.status === 'QUOTE' ? 'DEVIS' : null,
          subtotal,
          discountTotal,
          taxTotal,
          total,
          finalizedAt: shouldFinalize ? new Date() : null,
          items: {
            create: rawLines.map(line => ({
              productId: line.product.id,
              quantity: line.item.quantity,
              unitPrice: line.unitPrice,
              discount: line.item.discount,
              tvaRate: line.tvaRate,
              lineTotal: line.lineTotal,
            })),
          },
        },
      });

      if (shouldFinalize && data.method !== 'CREDIT') {
        await tx.payment.create({ data: { saleId: created.id, method: mapMethod(data.method), amount: total } });
      }

      if (shouldFinalize && data.method === 'CREDIT' && customer) {
        await tx.contact.update({ where: { id: customer.id }, data: { balance: { increment: total } } });
      }

      if (shouldFinalize) {
        for (const line of rawLines) {
          if (!line.product.trackStock || line.product.type === ProductType.SERVICE) continue;
          await tx.productStock.upsert({
            where: { productId_warehouseId: { productId: line.product.id, warehouseId: warehouse.id } },
            update: { quantity: { decrement: line.item.quantity } },
            create: { productId: line.product.id, warehouseId: warehouse.id, quantity: -line.item.quantity },
          });
          await tx.stockMovement.create({
            data: {
              productId: line.product.id,
              warehouseId: warehouse.id,
              type: 'OUT',
              quantity: line.item.quantity,
              reference: created.ticketNumber,
              notes: 'Vente POS',
            },
          });
        }
      }

      return tx.sale.findUnique({
        where: { id: created.id },
        include: { customer: true, payments: true, items: { include: { product: true } } },
      });
    });

    res.status(201).json(normalizeSale(sale));
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: 'Ticket invalide', errors: error.issues });
    const parsed = saleSchema.safeParse(req.body);
    if (parsed.success) {
      const data = parsed.data;
      const rawLines = data.items.map(item => {
        const product = demoCatalog.get(item.productId) || { name: 'Produit #' + item.productId, sku: 'PRD-' + item.productId, salePrice: 0, tvaRate: 20 };
        const lineNet = Math.max(0, (product.salePrice - item.discount) * item.quantity);
        const lineTax = lineNet * product.tvaRate / 100;
        return { item, product, lineNet, lineTax, lineTotal: lineNet + lineTax };
      });
      const subtotal = rawLines.reduce((sum, line) => sum + line.product.salePrice * line.item.quantity, 0);
      const lineDiscount = rawLines.reduce((sum, line) => sum + line.item.discount * line.item.quantity, 0);
      const orderDiscount = Math.max(0, subtotal - lineDiscount) * data.discountRate / 100;
      const discountTotal = lineDiscount + orderDiscount;
      const taxTotal = rawLines.reduce((sum, line) => sum + line.lineTax, 0);
      const total = Math.max(0, subtotal - discountTotal + taxTotal);
      const status = data.status === 'SUSPENDED' ? 'Suspendue' : data.status === 'QUOTE' ? 'Devis' : data.status === 'DRAFT' ? 'Brouillon' : data.method === 'CREDIT' ? 'Credit' : 'Payee';
      return res.status(201).json({
        id: Date.now(),
        ticket: (data.status === 'QUOTE' ? 'DEV' : data.status === 'SUSPENDED' ? 'SUS' : 'TCK') + '-' + Date.now().toString().slice(-5),
        customer: data.customerName || 'Client comptoir',
        total,
        subtotal,
        taxTotal,
        discountTotal,
        items: data.items.reduce((sum, item) => sum + item.quantity, 0),
        method: data.method,
        status,
        createdAt: 'Maintenant',
        lines: rawLines.map(line => ({
          productId: line.item.productId,
          name: line.product.name,
          sku: line.product.sku,
          quantity: line.item.quantity,
          unitPrice: line.product.salePrice,
          discount: line.item.discount,
          tvaRate: line.product.tvaRate,
          lineTotal: line.lineTotal,
        })),
        source: 'demo',
      });
    }
    console.error('Sale create error:', error);
    res.status(500).json({ message: 'Erreur lors de la validation du ticket' });
  }
});

router.patch('/:id/kitchen', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { kitchenStatus } = req.body;
    
    // In our schema, kitchenStatus doesn't explicitly exist as a field on Sale.
    // SaleStatus enum has KITCHEN and READY. We will update the status field if it matches.
    if (kitchenStatus === 'READY') {
      const sale = await prisma.sale.update({
        where: { id: Number(id) },
        data: { status: 'READY' }
      });
      res.json({ success: true, sale });
    } else {
      res.status(400).json({ message: 'Invalid kitchen status' });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
