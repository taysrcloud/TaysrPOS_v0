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
  tableId: z.coerce.number().int().positive().optional(),
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().positive(),
    discount: z.coerce.number().min(0).default(0),
    variationId: z.coerce.number().int().positive().optional(),
    note: z.string().optional(),
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
    variationId: item.variationId || undefined,
    name: item.variation?.name ? `${item.product?.name || 'Produit'} (${item.variation.name})` : item.product?.name || 'Produit',
    sku: item.variation?.sku || item.product?.sku || '',
    imageUrl: item.product?.imageUrl || null,
    quantity: asNumber(item.quantity),
    unitPrice: asNumber(item.unitPrice),
    discount: asNumber(item.discount),
    tvaRate: asNumber(item.tvaRate),
    lineTotal: asNumber(item.lineTotal),
    note: item.notes || undefined,
  })) || [],
});

router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const companyId = req.user.companyId;
    const company = { id: companyId };
    const locationId = req.query.locationId ? parseInt(req.query.locationId) : undefined;
    const sales = await prisma.sale.findMany({
      where: { companyId: company.id, ...(locationId ? { locationId } : {}) },
      include: { customer: true, payments: true, items: { include: { product: true, variation: true } } },
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
      const variation = item.variationId
        ? product.variations.find(variant => variant.id === item.variationId && variant.isActive)
        : null;

      if (item.variationId && !variation) {
        throw new Error('VARIATION_NOT_FOUND');
      }

      const unitPrice = variation?.salePrice != null ? asNumber(variation.salePrice) : asNumber(product.salePrice);
      const tvaRate = asNumber(product.tvaRate);
      const lineNet = Math.max(0, (unitPrice - item.discount) * item.quantity);
      const lineTax = lineNet * tvaRate / 100;
      return { item, product, variation, unitPrice, tvaRate, lineNet, lineTax, lineTotal: lineNet + lineTax };
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
          tableId: data.tableId,
          finalizedAt: shouldFinalize ? new Date() : null,
          items: {
            create: rawLines.map(line => ({
              productId: line.product.id,
              variationId: line.item.variationId,
              quantity: line.item.quantity,
              unitPrice: line.unitPrice,
              discount: line.item.discount,
              tvaRate: line.tvaRate,
              lineTotal: line.lineTotal,
              notes: line.item.note,
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
            where: { productId_warehouseId_variationId: { productId: line.product.id, warehouseId: warehouse.id, variationId: line.item.variationId ?? null } } as any,
            update: { quantity: { decrement: line.item.quantity } },
            create: { productId: line.product.id, warehouseId: warehouse.id, variationId: line.item.variationId, quantity: -line.item.quantity },
          });
          await tx.stockMovement.create({
            data: {
              productId: line.product.id,
              warehouseId: warehouse.id,
              type: 'OUT',
              quantity: line.item.quantity,
              reference: created.ticketNumber,
              notes: line.variation ? `Vente POS - ${line.variation.name}` : 'Vente POS',
            },
          });
        }
      }

      return tx.sale.findUnique({
        where: { id: created.id },
        include: { customer: true, payments: true, items: { include: { product: true, variation: true } } },
      });
    });

    res.status(201).json(normalizeSale(sale));
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: 'Ticket invalide', errors: error.issues });
    if (error?.message === 'VARIATION_NOT_FOUND') return res.status(400).json({ message: 'Une declinaison du panier est inactive ou introuvable' });
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
          variationId: line.item.variationId,
          name: line.product.name,
          sku: line.product.sku,
          imageUrl: null,
          quantity: line.item.quantity,
          unitPrice: line.product.salePrice,
          discount: line.item.discount,
          tvaRate: line.product.tvaRate,
          lineTotal: line.lineTotal,
          note: line.item.note,
        })),
        source: 'demo',
      });
    }
    console.error('Sale create error:', error);
    res.status(500).json({ message: 'Erreur lors de la validation du ticket' });
  }
});

router.patch('/:id/kitchen', async (req: any, res: any, next) => {
  try {
    const { id } = req.params;
    const { kitchenStatus } = req.body;
    
    // We will update the status of the Sale to READY if that's what's sent, or update items.
    // For simplicity, we just mark the sale status for now since the UI uses it.
    if (kitchenStatus === 'READY') {
      const sale = await prisma.sale.update({
        where: { id: Number(id) },
        data: { status: 'READY' }
      });
      res.json({ success: true, sale: normalizeSale(sale) });
    } else {
      res.status(400).json({ message: 'Invalid kitchen status' });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/:id/split', requireAuth, async (req: any, res: any, next) => {
  try {
    const { id } = req.params;
    // selectedItems is an array of { productId, quantity }
    const { selectedItems } = req.body; 
    
    if (!selectedItems || !selectedItems.length) {
      return res.status(400).json({ message: 'No items selected to split' });
    }

    const companyId = req.user.companyId;

    const originalSale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { items: true }
    });

    if (!originalSale || originalSale.companyId !== companyId) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create new sale
      const newSale = await tx.sale.create({
        data: {
          companyId,
          locationId: originalSale.locationId,
          customerId: originalSale.customerId,
          tableId: originalSale.tableId,
          channel: originalSale.channel,
          status: originalSale.status,
          paymentStatus: originalSale.paymentStatus,
          ticketNumber: `TCK-${Date.now().toString().slice(-7)}-S`,
          items: {
            create: selectedItems.map((si: any) => {
              const origItem = originalSale.items.find(i => i.productId === si.productId);
              return {
                productId: si.productId,
                quantity: si.quantity,
                unitPrice: origItem?.unitPrice || 0,
                discount: origItem?.discount || 0,
                tvaRate: origItem?.tvaRate || 0,
                lineTotal: (Number(origItem?.unitPrice || 0) - Number(origItem?.discount || 0)) * si.quantity
              };
            })
          }
        },
        include: { items: { include: { product: true } }, customer: true, payments: true }
      });

      // Update new sale totals
      const newSub = newSale.items.reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0);
      const newTax = newSale.items.reduce((s, i) => s + (Number(i.lineTotal) * Number(i.tvaRate) / 100), 0);
      const newTot = newSub + newTax; // simplistic, ignoring order discount for split

      await tx.sale.update({
        where: { id: newSale.id },
        data: { subtotal: newSub, taxTotal: newTax, total: newTot }
      });

      // Update original sale items by decrementing quantities
      for (const si of selectedItems) {
        const origItem = originalSale.items.find(i => i.productId === si.productId);
        if (origItem) {
          const newQty = Number(origItem.quantity) - si.quantity;
          if (newQty <= 0) {
            await tx.saleItem.delete({ where: { id: origItem.id } });
          } else {
            const newLineTotal = (Number(origItem.unitPrice) - Number(origItem.discount)) * newQty;
            await tx.saleItem.update({
              where: { id: origItem.id },
              data: { quantity: newQty, lineTotal: newLineTotal }
            });
          }
        }
      }

      // Recalculate original sale totals
      const updatedOriginalItems = await tx.saleItem.findMany({ where: { saleId: originalSale.id } });
      const origSub = updatedOriginalItems.reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0);
      const origTax = updatedOriginalItems.reduce((s, i) => s + (Number(i.lineTotal) * Number(i.tvaRate) / 100), 0);
      const origTot = origSub + origTax;

      const updatedOriginal = await tx.sale.update({
        where: { id: originalSale.id },
        data: { subtotal: origSub, taxTotal: origTax, total: origTot },
        include: { items: { include: { product: true } }, customer: true, payments: true }
      });

      return { originalSale: updatedOriginal, newSale };
    });

    res.json({
      success: true,
      originalSale: normalizeSale(result.originalSale),
      newSale: normalizeSale(result.newSale)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/merge', requireAuth, async (req: any, res: any, next) => {
  try {
    const { saleIds } = req.body; // Array of sale IDs to merge
    if (!saleIds || saleIds.length < 2) {
      return res.status(400).json({ message: 'Need at least 2 sales to merge' });
    }
    
    const companyId = req.user.companyId;

    const sales = await prisma.sale.findMany({
      where: { companyId, id: { in: saleIds } },
      include: { items: true }
    });

    if (sales.length !== saleIds.length) {
      return res.status(400).json({ message: 'Some sales not found' });
    }

    const primarySale = sales[0];
    const salesToMerge = sales.slice(1);

    const result = await prisma.$transaction(async (tx) => {
      // Move items to primary sale
      for (const sale of salesToMerge) {
        for (const item of sale.items) {
          // Check if item exists in primary
          const existingItem = await tx.saleItem.findFirst({
            where: { saleId: primarySale.id, productId: item.productId, variationId: item.variationId }
          });

          if (existingItem) {
            await tx.saleItem.update({
              where: { id: existingItem.id },
              data: {
                quantity: Number(existingItem.quantity) + Number(item.quantity),
                lineTotal: Number(existingItem.lineTotal) + Number(item.lineTotal)
              }
            });
          } else {
            await tx.saleItem.create({
              data: {
                saleId: primarySale.id,
                productId: item.productId,
                variationId: item.variationId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                tvaRate: item.tvaRate,
                lineTotal: item.lineTotal
              }
            });
          }
        }
        
        // Delete merged sales
        await tx.saleItem.deleteMany({ where: { saleId: sale.id } });
        await tx.sale.delete({ where: { id: sale.id } });
      }

      // Recalculate primary sale
      const updatedPrimaryItems = await tx.saleItem.findMany({ where: { saleId: primarySale.id } });
      const newSub = updatedPrimaryItems.reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0);
      const newTax = updatedPrimaryItems.reduce((s, i) => s + (Number(i.lineTotal) * Number(i.tvaRate) / 100), 0);
      const newTot = newSub + newTax;

      const updatedPrimary = await tx.sale.update({
        where: { id: primarySale.id },
        data: { subtotal: newSub, taxTotal: newTax, total: newTot },
        include: { items: { include: { product: true } }, customer: true, payments: true }
      });

      return updatedPrimary;
    });

    res.json({ success: true, primarySale: normalizeSale(result) });
  } catch (error) {
    next(error);
  }
});

export default router;

