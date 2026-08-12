import { requireAuth } from '../middleware/auth.js';
import { Router } from 'express';
import { z } from 'zod';
import { PaymentMethod, PaymentStatus, ProductType, SaleChannel, SaleStatus } from '../generated/client/index.js';
import { prisma } from '../utils/prisma.js';
import { generateInvoicePDF, generateReceiptPDF, type PdfCompany } from '../utils/pdf.js';

const router = Router();

const saleSchema = z.object({
  customerId: z.coerce.number().int().positive().optional().nullable(),
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
  return 'Payée';
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
      where: { companyId, ...(locationId ? { locationId } : {}) },
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

// Shared load for the receipt/invoice document routes below: fetches the sale
// (tenant-scoped, matching GET /'s include exactly so normalizeSale has
// payments/variation data to work with) and the company fiscal info, or
// returns null if either lookup fails. All validation must finish before a
// PDF generator is invoked - pdfkit pipes straight to res and calls doc.end(),
// so once it starts there is no way to send a JSON error instead.
const loadSaleForDocument = async (saleId: number, companyId: number) => {
  const [sale, company] = await Promise.all([
    prisma.sale.findFirst({
      where: { id: saleId, companyId },
      include: { customer: true, payments: true, items: { include: { product: true, variation: true } } },
    }),
    prisma.company.findUnique({ where: { id: companyId } }),
  ]);
  if (!sale || !company) return null;
  const pdfCompany: PdfCompany = {
    name: company.name,
    legalName: company.legalName,
    address: company.address,
    city: company.city,
    ice: company.ice,
    ifNumber: company.ifNumber,
    rc: company.rc,
    receiptFooter: company.receiptFooter,
  };
  return { sale: normalizeSale(sale), company: pdfCompany };
};

router.get('/:id/receipt', requireAuth, async (req: any, res: any, next) => {
  try {
    const saleId = Number(req.params.id);
    const loaded = await loadSaleForDocument(saleId, req.user.companyId);
    if (!loaded) return res.status(404).json({ message: 'Vente introuvable' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ticket-${loaded.sale.ticket}.pdf"`);
    generateReceiptPDF(loaded.sale, res, loaded.company);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/invoice', requireAuth, async (req: any, res: any, next) => {
  try {
    const saleId = Number(req.params.id);
    const loaded = await loadSaleForDocument(saleId, req.user.companyId);
    if (!loaded) return res.status(404).json({ message: 'Vente introuvable' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="facture-${loaded.sale.ticket}.pdf"`);
    generateInvoicePDF(loaded.sale, res, loaded.company);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res) => {
  try {
    const data = saleSchema.parse(req.body);
    const companyId = (req as any).user.companyId;

    let location = await prisma.location.findFirst({
      where: data.locationId ? { id: data.locationId, companyId } : { companyId }
    });
    if (!location) return res.status(400).json({ message: 'Location not found' });

    let warehouse = await prisma.warehouse.findFirst({
      where: { companyId, locationId: location.id }
    });
    if (!warehouse) {
      warehouse = await prisma.warehouse.findFirst({ where: { companyId } });
    }
    if (!warehouse) return res.status(400).json({ message: 'Warehouse not found' });

    if (data.tableId) {
      const table = await prisma.restaurantTable.findFirst({ where: { id: data.tableId, companyId } });
      if (!table) return res.status(404).json({ message: 'Table introuvable' });
    }

    const productIds = [...new Set(data.items.map(item => item.productId))];
    const products = await prisma.product.findMany({
      where: { companyId, id: { in: productIds }, isActive: true },
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
      let customer = null;
      if (data.customerId) {
        customer = await tx.contact.findFirst({ where: { id: data.customerId, companyId } });
        if (!customer) throw new Error('CUSTOMER_NOT_FOUND');
      } else if (customerName !== 'Client comptoir') {
        customer = await tx.contact.create({ data: { companyId, type: 'CUSTOMER', fullName: customerName } });
      }

      const created = await tx.sale.create({
        data: {
          companyId,
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
          const existingStock = await tx.productStock.findFirst({
            where: { productId: line.product.id, warehouseId: warehouse.id, variationId: line.item.variationId ?? null },
          });
          if (existingStock) {
            await tx.productStock.update({ where: { id: existingStock.id }, data: { quantity: { decrement: line.item.quantity } } });
          } else {
            await tx.productStock.create({ data: { productId: line.product.id, warehouseId: warehouse.id, variationId: line.item.variationId, quantity: -line.item.quantity } });
          }
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
    if (error?.message === 'CUSTOMER_NOT_FOUND') return res.status(404).json({ message: 'Client introuvable' });
    console.error('Sale create error:', error);
    res.status(500).json({ message: 'Erreur lors de la validation du ticket' });
  }
});

// Finalize a draft/quote/suspended sale directly (convert to FINAL with payment)
router.patch('/:id/finalize', requireAuth, async (req: any, res: any, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;
    const { method = 'CASH', customerId: newCustomerId } = req.body;

    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: {
        items: { include: { product: true, variation: true } },
        customer: true,
      },
    });
    if (!sale || sale.companyId !== companyId) return res.status(404).json({ message: 'Vente introuvable' });
    if (sale.status === SaleStatus.FINAL) return res.status(400).json({ message: 'Cette vente est déjà finalisée' });

    if (newCustomerId) {
      const customer = await prisma.contact.findFirst({ where: { id: Number(newCustomerId), companyId } });
      if (!customer) return res.status(404).json({ message: 'Client introuvable' });
    }

    const paymentMethod: PaymentMethod = method === 'CARD' ? PaymentMethod.CARD : method === 'CREDIT' ? PaymentMethod.CREDIT : PaymentMethod.CASH;
    const isCredit = paymentMethod === PaymentMethod.CREDIT;
    const total = Number(sale.total);

    const company = await prisma.company.findFirst({ where: { id: companyId } });
    const warehouse = company ? await prisma.warehouse.findFirst({ where: { companyId } }) : null;

    const updated = await prisma.$transaction(async (tx) => {
      // Update sale to FINAL
      const finalized = await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.FINAL,
          paymentStatus: isCredit ? PaymentStatus.UNPAID : PaymentStatus.PAID,
          note: null,  // clear DEVIS note
          finalizedAt: new Date(),
          ...(newCustomerId ? { customerId: newCustomerId } : {}),
        },
        include: { customer: true, payments: true, items: { include: { product: true, variation: true } } },
      });

      // Create payment record unless credit
      if (!isCredit) {
        await tx.payment.create({
          data: { saleId: sale.id, method: paymentMethod, amount: total },
        });
      }

      // Update customer balance for credit sales
      if (isCredit && (finalized.customerId || newCustomerId)) {
        await tx.contact.update({
          where: { id: finalized.customerId || newCustomerId },
          data: { balance: { increment: total } },
        });
      }

      // Decrement stock for tracked products
      if (warehouse) {
        for (const item of sale.items) {
          if (!item.product.trackStock || item.product.type === ProductType.SERVICE) continue;
          const existingStock = await tx.productStock.findFirst({
            where: { productId: item.productId, warehouseId: warehouse.id, variationId: item.variationId ?? null },
          });
          if (existingStock) {
            await tx.productStock.update({ where: { id: existingStock.id }, data: { quantity: { decrement: Number(item.quantity) } } });
          } else {
            await tx.productStock.create({ data: { productId: item.productId, warehouseId: warehouse.id, variationId: item.variationId, quantity: -Number(item.quantity) } });
          }
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId: warehouse.id,
              type: 'OUT',
              quantity: Number(item.quantity),
              reference: finalized.ticketNumber || `TCK-${sale.id}`,
              notes: item.variation ? `Vente POS (converti) - ${item.variation.name}` : 'Vente POS (converti depuis devis)',
            },
          });
        }
      }

      return tx.sale.findUnique({
        where: { id: sale.id },
        include: { customer: true, payments: true, items: { include: { product: true, variation: true } } },
      });
    });

    res.json({ success: true, sale: normalizeSale(updated) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req: any, res: any, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;
    const sale = await prisma.sale.findUnique({ where: { id: Number(id) } });
    if (!sale || sale.companyId !== companyId) return res.status(404).json({ message: 'Sale not found' });
    if (sale.status === 'FINAL') return res.status(400).json({ message: 'Cannot delete finalized sale' });
    
    await prisma.saleItem.deleteMany({ where: { saleId: sale.id } });
    await prisma.sale.delete({ where: { id: sale.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/kitchen', requireAuth, async (req: any, res: any, next) => {
  try {
    const { id } = req.params;
    const { kitchenStatus } = req.body;
    
    // We will update the status of the Sale to READY if that's what's sent, or update items.
    // For simplicity, we just mark the sale status for now since the UI uses it.
    if (kitchenStatus === 'READY') {
      const ownedSale = await prisma.sale.findFirst({ where: { id: Number(id), companyId: req.user.companyId } });
      if (!ownedSale) return res.status(404).json({ message: 'Sale not found' });
      const sale = await prisma.sale.update({
        where: { id: ownedSale.id },
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

router.post('/:id/return', requireAuth, async (req: any, res: any, next) => {
  try {
    const saleId = Number(req.params.id);
    const companyId = req.user.companyId;

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, companyId },
      include: { items: { include: { product: true } } }
    });

    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    if (sale.status === 'RETURNED') return res.status(400).json({ message: 'Sale is already returned' });

    let warehouse = await prisma.warehouse.findFirst({
      where: { companyId, locationId: sale.locationId }
    });
    if (!warehouse) {
      warehouse = await prisma.warehouse.findFirst({ where: { companyId } });
    }

    const updatedSale = await prisma.$transaction(async (tx) => {
      if (warehouse) {
        for (const item of sale.items) {
          if (!item.product.trackStock || item.product.type === 'SERVICE') continue;
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId: warehouse.id,
              type: 'IN',
              quantity: item.quantity,
              reference: sale.ticketNumber,
              notes: 'Retour Vente'
            }
          });
          await tx.productStock.updateMany({
            where: { productId: item.productId, warehouseId: warehouse.id, variationId: item.variationId },
            data: { quantity: { increment: item.quantity } }
          });
        }
      }

      // Handle customer balance if it was a credit sale
      const payments = await tx.payment.findMany({ where: { saleId: sale.id } });
      const wasCredit = payments.some(p => p.method === 'CREDIT') || (sale.status === 'FINAL' && payments.length === 0);
      if (wasCredit && sale.customerId) {
        await tx.contact.update({
          where: { id: sale.customerId },
          data: { balance: { decrement: sale.total } }
        });
      }

      return await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'RETURNED' },
        include: { items: { include: { product: true, variation: true } }, customer: true, payments: true }
      });
    });

    res.json(normalizeSale(updatedSale));
  } catch (error) {
    next(error);
  }
});

export default router;

