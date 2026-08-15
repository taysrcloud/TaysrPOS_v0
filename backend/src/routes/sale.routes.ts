import { requireAuth } from '../middleware/auth.js';
import { Router } from 'express';
import { z } from 'zod';
import { PaymentMethod, PaymentStatus, ProductType, SaleChannel, SaleStatus } from '../generated/client/index.js';
import { prisma } from '../utils/prisma.js';
import { generateInvoicePDF, generateReceiptPDF, type PdfCompany } from '../utils/pdf.js';
import { getOrCreateCashAccount, postCashTransaction } from '../utils/accounting.js';
import { resolveCustomerGroupPrices } from '../utils/pricing.js';
import { triggerNotificationEvent } from '../utils/notifications.js';
import { adjustProductStock } from '../utils/stock.js';

const router = Router();

const saleSchema = z.object({
  customerId: z.coerce.number().int().positive().optional().nullable(),
  customerName: z.string().trim().optional().default('Client comptoir'),
  method: z.enum(['CASH', 'CARD', 'CREDIT', 'MULTI']).default('CASH'),
  status: z.enum(['FINAL', 'DRAFT', 'SUSPENDED', 'QUOTE']).default('FINAL'),
  discountRate: z.coerce.number().min(0).max(100).default(0),
  locationId: z.coerce.number().int().positive().optional(),
  tableId: z.coerce.number().int().positive().optional(),
  // Track H: optional foreign-currency record. total/subtotal/taxTotal stay
  // in MAD always (computed from items exactly as before) - this just
  // resolves and snapshots what that MAD total equals in another currency.
  currencyId: z.coerce.number().int().positive().optional(),
  exchangeRate: z.coerce.number().positive().optional(),
  commissionAgentId: z.coerce.number().int().positive().optional(),
  // Split-payment breakdown for method: 'MULTI'. Was previously accepted by
  // the frontend's payload but silently stripped here (a plain z.object()
  // drops unrecognized keys) - the register recorded one lump Payment row
  // for the full total under PaymentMethod.MIXED regardless of the actual
  // cash/card/credit mix a cashier entered, and the Z-report's cash-drawer
  // reconciliation had no real data to attribute cash correctly. See
  // TRACE.md's split-payment persistence entry.
  splitPayments: z.array(z.object({
    method: z.enum(['CASH', 'CARD', 'CREDIT', 'STORE_CREDIT']),
    amount: z.coerce.number().positive(),
  })).optional(),
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

// STORE_CREDIT isn't a real tracked rail yet (Contact.storeCredit doesn't
// exist in the schema - the register's store-credit balance/top-up is
// entirely local frontend state, wiped on every refresh; flagged, not
// fixed, in this pass). MIXED is the most defensible existing enum value
// for its Payment row: not cash, not card, not a real receivable.
const mapSplitMethod = (method: 'CASH' | 'CARD' | 'CREDIT' | 'STORE_CREDIT'): PaymentMethod => {
  if (method === 'STORE_CREDIT') return PaymentMethod.MIXED;
  return method as PaymentMethod;
};

const statusLabel = (sale: any) => {
  if (sale.status === SaleStatus.SUSPENDED) return 'Suspendue';
  if (sale.status === SaleStatus.DRAFT && sale.note === 'DEVIS') return 'Devis';
  if (sale.status === SaleStatus.DRAFT) return 'Brouillon';
  // Was previously falling through to the default 'Payee' branch below, making a
  // returned sale indistinguishable from a normal completed one in every consumer
  // that reads this label. 'Retour' is already a recognized SaleRecord['status']
  // value on the frontend (frontend/src/main.tsx), just never produced until now.
  if (sale.status === SaleStatus.RETURNED || sale.status === SaleStatus.PARTIALLY_RETURNED) return 'Retour';
  if (sale.paymentStatus === PaymentStatus.UNPAID) return 'Credit';
  // Unaccented deliberately: every frontend comparison (frontend/src/main.tsx,
  // ~20 call sites - Reports, Payments, Dashboard, register shift totals,
  // invoiceable-sales detection) checks the literal string 'Payee'. This used to
  // return the accented 'Payée' (U+00E9), which never matched any of them - a
  // real, previously undiscovered bug verified at the byte level on 2026-08-12
  // (see TRACE.md). Do not add the accent back without also updating every
  // frontend comparison in the same change.
  return 'Payee';
};

const methodLabel = (sale: any) => {
  // Real bug found live 2026-08-13 while verifying the split-payment fix: a
  // MULTI sale used to always have exactly one Payment row (tagged MIXED), so
  // reading payments[0].method alone was a safe proxy for "how was this sale
  // paid". Split-payment persistence now creates one row per tender
  // component, so payments[0] can be CARD or CREDIT for a sale that was
  // genuinely split - picking that single row mislabeled the whole sale
  // (verified live: a 36 MAD cash+card split showed up as a pure 'CARD' sale,
  // which silently dropped its cash portion from the Z-report's cash-drawer
  // total). Must check the row count first.
  if ((sale.payments?.length || 0) > 1) return 'MULTI';
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
    // Was missing entirely - every consumer that filters sales by location
    // (e.g. the Dashboard's forced location scoping) silently excluded every
    // real sale, since `undefined === locationId` is always false. Found
    // 2026-08-12 via live browser verification. See TRACE.md.
    locationId: sale.locationId ?? null,
  ticket: sale.ticketNumber || `TCK-${String(sale.id).padStart(4, '0')}`,
  customer: sale.customer?.fullName || 'Client comptoir',
  total: asNumber(sale.total),
  subtotal: asNumber(sale.subtotal),
  taxTotal: asNumber(sale.taxTotal),
  discountTotal: asNumber(sale.discountTotal),
  // Track H: null unless a foreign currency was recorded at creation. total
  // above always stays the MAD figure - this is purely the equivalent.
  currencyId: sale.currencyId ?? null,
  exchangeRate: sale.exchangeRate != null ? asNumber(sale.exchangeRate) : null,
  foreignTotal: sale.foreignTotal != null ? asNumber(sale.foreignTotal) : null,
  items: sale.items?.reduce((sum: number, item: any) => sum + asNumber(item.quantity), 0) || 0,
  method: methodLabel(sale),
  // Real per-tender breakdown (was previously unavailable - the register's
  // client-local `splitPayments` never round-tripped through the API and the
  // backend never persisted more than one lump payment row for MULTI sales).
  // Consumed by the Z-report's cash-drawer reconciliation for MULTI sales.
  payments: sale.payments?.map((p: any) => ({ method: p.method, amount: asNumber(p.amount) })) || [],
  status: statusLabel(sale),
  createdAt: sale.createdAt ? new Date(sale.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Maintenant',
  // Unambiguous ISO 8601 timestamp for date arithmetic (period filters, day
  // bucketing) on the frontend. `createdAt` above is a pre-formatted DD/MM
  // HH:mm display string and must never be parsed with `new Date(...)` -
  // JS reads that format as US MM/DD with no year, silently producing wrong
  // dates for real data (verified: "12/08 20:02" -> December 8, 2001). See
  // TRACE.md 2026-08-12.
  createdAtISO: sale.createdAt ? new Date(sale.createdAt).toISOString() : new Date().toISOString(),
  lines: sale.items?.map((item: any) => ({
    id: item.id,
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
    // Track A return flow: how much of this line was already returned, so the
    // frontend can compute a returnable remainder for a partial-return picker.
    returnedQty: item.returnedQty != null ? asNumber(item.returnedQty) : 0,
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

    // Track C: a customer's selling-price-group override applies to the base
    // product price only - a selected variation's own salePrice still wins
    // (ProductGroupPrice has no variation dimension in the schema).
    const groupPrices = await resolveCustomerGroupPrices(prisma, companyId, data.customerId, productIds);

    const productMap = new Map(products.map(product => [product.id, product]));
    const rawLines = data.items.map(item => {
      const product = productMap.get(item.productId)!;
      const variation = item.variationId
        ? product.variations.find(variant => variant.id === item.variationId && variant.isActive)
        : null;

      if (item.variationId && !variation) {
        throw new Error('VARIATION_NOT_FOUND');
      }

      const unitPrice = variation?.salePrice != null
        ? asNumber(variation.salePrice)
        : (groupPrices.get(item.productId) ?? asNumber(product.salePrice));
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

    // Track H: resolve + snapshot the foreign-currency equivalent before the
    // transaction starts, same place location/warehouse/table are validated.
    // total stays in MAD - this is purely the recorded equivalent.
    let currencyId: number | undefined;
    let exchangeRate: number | undefined;
    let foreignTotal: number | undefined;
    if (data.currencyId) {
      const currency = await prisma.currency.findFirst({ where: { id: data.currencyId, companyId } });
      if (!currency) return res.status(400).json({ message: 'Devise invalide' });
      exchangeRate = data.exchangeRate ?? asNumber(currency.rate);
      currencyId = currency.id;
      foreignTotal = Math.round((total / exchangeRate) * 100) / 100;
    }

    const shouldFinalize = data.status === 'FINAL';
    const saleStatus = data.status === 'SUSPENDED' ? SaleStatus.SUSPENDED : data.status === 'FINAL' ? SaleStatus.FINAL : SaleStatus.DRAFT;
    // Note: a MULTI sale with a non-zero credit component is still marked
    // PAID here (not a real PARTIAL state, which the schema doesn't have).
    // Contact.balance is the actual source of truth for what's still owed
    // (same "aggregate, not per-sale" convention the settlement endpoint
    // already relies on) - the settlement flow at /contacts/:id/settle works
    // correctly against it regardless of this sale's own status label.
    const paymentStatus = !shouldFinalize ? PaymentStatus.UNPAID : data.method === 'CREDIT' ? PaymentStatus.UNPAID : PaymentStatus.PAID;

    // Split-payment reconciliation for MULTI sales. Raw tendered amounts from
    // the register can overpay (change due) - only CASH supports that concept
    // in a real till; CARD/CREDIT/STORE_CREDIT are always face-value entries
    // (there's no "change" for a card charge). Non-cash components are taken
    // at face value and validated against total; CASH is the remainder
    // "plug", capped at what's actually still owed after those - any cash
    // entered above that is change handed back to the customer, not sale
    // revenue, and must never become a Payment amount or hit the ledger.
    let splitPayments: { method: 'CASH' | 'CARD' | 'CREDIT' | 'STORE_CREDIT'; amount: number }[] = [];
    if (shouldFinalize && data.method === 'MULTI') {
      if (!data.splitPayments?.length) return res.status(400).json({ message: 'Paiement partage sans detail de reglement' });
      const nonCash = data.splitPayments.filter(p => p.method !== 'CASH');
      const nonCashSum = nonCash.reduce((sum, p) => sum + p.amount, 0);
      if (nonCashSum > total + 0.01) {
        return res.status(400).json({ message: 'Le montant carte/credit/credit magasin depasse le total du ticket' });
      }
      const cashOwed = Math.max(0, total - nonCashSum);
      const cashEntry = data.splitPayments.find(p => p.method === 'CASH');
      if (cashOwed > 0.01 && (!cashEntry || cashEntry.amount < cashOwed - 0.01)) {
        return res.status(400).json({ message: 'Paiement insuffisant pour couvrir le total du ticket' });
      }
      splitPayments = [
        ...nonCash,
        ...(cashOwed > 0.01 ? [{ method: 'CASH' as const, amount: Math.round(cashOwed * 100) / 100 }] : []),
      ];
    }

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
          commissionAgentId: data.commissionAgentId,
          channel: SaleChannel.RETAIL,
          status: saleStatus,
          paymentStatus,
          ticketNumber: `TCK-${Date.now().toString().slice(-7)}`,
          note: data.status === 'QUOTE' ? 'DEVIS' : null,
          subtotal,
          discountTotal,
          taxTotal,
          total,
          currencyId,
          exchangeRate,
          foreignTotal,
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

      if (shouldFinalize && data.method === 'MULTI') {
        for (const split of splitPayments) {
          await tx.payment.create({ data: { saleId: created.id, method: mapSplitMethod(split.method), amount: split.amount } });
        }
        const creditPortion = splitPayments.filter(p => p.method === 'CREDIT').reduce((sum, p) => sum + p.amount, 0);
        // STORE_CREDIT is excluded from the ledger DEBIT below AND from the
        // customer receivable here - it isn't real money and isn't (yet) a
        // real tracked balance either, so it can only be excluded, not
        // reconciled against anything. See mapSplitMethod's comment.
        const storeCreditPortion = splitPayments.filter(p => p.method === 'STORE_CREDIT').reduce((sum, p) => sum + p.amount, 0);
        if (creditPortion > 0) {
          if (!customer) throw new Error('CREDIT_REQUIRES_CUSTOMER');
          await tx.contact.update({ where: { id: customer.id }, data: { balance: { increment: creditPortion } } });
        }
        // Track D auto-posting: only the portion actually received as
        // cash/card moves into the ledger - the credit portion isn't cash
        // (tracked instead via customer.balance above), and the store-credit
        // portion was never real money to begin with (previously this whole
        // branch posted the FULL total as a cash DEBIT even for a
        // store-credit-only sale, corrupting the real "Caisse" account with
        // phantom cash that was never received - see TRACE.md).
        const receivedPortion = Math.max(0, total - creditPortion - storeCreditPortion);
        if (receivedPortion > 0) {
          const account = await getOrCreateCashAccount(tx, companyId, location.id);
          await postCashTransaction(tx, account, 'DEBIT', receivedPortion, `SALE-${created.id}`, created.ticketNumber ?? undefined);
        }
      } else if (shouldFinalize && data.method !== 'CREDIT') {
        await tx.payment.create({ data: { saleId: created.id, method: mapMethod(data.method), amount: total } });
        // Track D auto-posting, increment 3: real cash/card/bank payment
        // received now - CREDIT sales post nothing here (handled below via
        // customer.balance, no cash moved yet).
        const account = await getOrCreateCashAccount(tx, companyId, location.id);
        await postCashTransaction(tx, account, 'DEBIT', total, `SALE-${created.id}`, created.ticketNumber ?? undefined);
      }

      if (shouldFinalize && data.method === 'CREDIT' && customer) {
        await tx.contact.update({ where: { id: customer.id }, data: { balance: { increment: total } } });
      }

      if (shouldFinalize) {
        for (const line of rawLines) {
          if (!line.product.trackStock || line.product.type === ProductType.SERVICE) continue;
          await adjustProductStock(tx, line.product.id, warehouse.id, line.item.variationId, -line.item.quantity);
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

    if (shouldFinalize && sale) {
      triggerNotificationEvent(companyId, 'NEW_SALE', {
        entityId: sale.id,
        title: `Nouvelle vente ${sale.ticketNumber}`,
        note: `Vente finalisée d'un montant de ${total}`
      }).catch(console.error);

      if (data.method !== 'CREDIT') {
        const received = sale.payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;
        if (received > 0) {
          triggerNotificationEvent(companyId, 'PAYMENT_RECEIVED', {
            entityId: sale.id,
            title: `Paiement reçu (${sale.ticketNumber})`,
            note: `Montant encaissé: ${received}`
          }).catch(console.error);
        }
      }
    }

    res.status(201).json(normalizeSale(sale));
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: 'Ticket invalide', errors: error.issues });
    if (error?.message === 'VARIATION_NOT_FOUND') return res.status(400).json({ message: 'Une declinaison du panier est inactive ou introuvable' });
    if (error?.message === 'CUSTOMER_NOT_FOUND') return res.status(404).json({ message: 'Client introuvable' });
    if (error?.message === 'CREDIT_REQUIRES_CUSTOMER') return res.status(400).json({ message: 'Le client comptoir ne peut pas avoir de credit' });
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
        // Track D auto-posting, increment 3 (same rule as the primary POST /
        // finalize path above).
        const account = await getOrCreateCashAccount(tx, companyId, sale.locationId);
        await postCashTransaction(tx, account, 'DEBIT', total, `SALE-${sale.id}`, finalized.ticketNumber ?? undefined);
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
          await adjustProductStock(tx, item.productId, warehouse.id, item.variationId, -Number(item.quantity));
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

    if (updated) {
      triggerNotificationEvent(companyId, 'NEW_SALE', {
        entityId: updated.id,
        title: `Nouvelle vente ${updated.ticketNumber}`,
        note: `Vente finalisée d'un montant de ${total}`
      }).catch(console.error);

      if (!isCredit) {
        triggerNotificationEvent(companyId, 'PAYMENT_RECEIVED', {
          entityId: updated.id,
          title: `Paiement reçu (${updated.ticketNumber})`,
          note: `Montant encaissé: ${total}`
        }).catch(console.error);
      }
    }

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
    const parsed = z.object({
      // Optional per-item partial return. Omitted (or an item omitted from the array)
      // means "return whatever remains outstanding on that line" - preserves the
      // pre-existing full-return behavior of this endpoint as the default.
      items: z.array(z.object({
        saleItemId: z.number(),
        quantity: z.number().positive()
      })).optional()
    }).parse(req.body || {});

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, companyId },
      include: { items: { include: { product: true } } }
    });

    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    if (sale.status === 'RETURNED') return res.status(400).json({ message: 'Sale is already returned' });

    const requestedByItemId = new Map(parsed.items?.map(i => [i.saleItemId, i.quantity]) ?? []);
    const returnLines: { item: (typeof sale.items)[number]; quantity: number }[] = [];
    for (const item of sale.items) {
      const alreadyReturned = Number(item.returnedQty ?? 0);
      const remaining = Number(item.quantity) - alreadyReturned;
      if (remaining <= 0) continue;
      const requested = requestedByItemId.has(item.id) ? requestedByItemId.get(item.id)! : remaining;
      if (requested > remaining) return res.status(400).json({ message: `Quantite superieure au reste retournable pour l'article ${item.id}` });
      if (requested > 0) returnLines.push({ item, quantity: requested });
    }

    if (returnLines.length === 0) return res.status(400).json({ message: 'Rien a retourner' });

    let warehouse = await prisma.warehouse.findFirst({
      where: { companyId, locationId: sale.locationId }
    });
    if (!warehouse) {
      warehouse = await prisma.warehouse.findFirst({ where: { companyId } });
    }

    // Proportional balance reversal: what fraction of the sale's line-level value
    // (before any order-level discount) is being returned, applied to sale.total
    // (which already reflects that discount). Reduces to sale.total exactly when
    // everything outstanding is returned in one call, matching the prior full-return
    // behavior of decrementing the whole total.
    const originalLineTotalSum = sale.items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
    const returnedLineTotalSum = returnLines.reduce((sum, { item, quantity }) => sum + (Number(item.lineTotal) * quantity) / Number(item.quantity), 0);
    const balanceDelta = originalLineTotalSum > 0 ? Number(sale.total) * (returnedLineTotalSum / originalLineTotalSum) : 0;

    const updatedSale = await prisma.$transaction(async (tx) => {
      for (const { item, quantity } of returnLines) {
        if (warehouse && item.product.trackStock && item.product.type !== 'SERVICE') {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId: warehouse.id,
              type: 'IN',
              quantity,
              reference: sale.ticketNumber,
              notes: 'Retour Vente'
            }
          });
          await tx.productStock.updateMany({
            where: { productId: item.productId, warehouseId: warehouse.id, variationId: item.variationId },
            data: { quantity: { increment: quantity } }
          });
        }

        await tx.saleItem.update({
          where: { id: item.id },
          data: { returnedQty: Number(item.returnedQty ?? 0) + quantity }
        });
      }

      // Handle customer balance if it was a credit sale. Credit sales never get a
      // Payment row (see the finalize handler above - balance is incremented directly
      // instead), so zero payments on a sale that was actually finalized (not still
      // DRAFT/SUSPENDED) identifies it. Deliberately does NOT check sale.status ===
      // 'FINAL' here: on a second/subsequent partial return, status has already moved
      // to PARTIALLY_RETURNED from the first call, and that must not turn off balance
      // reversal for the rest of the line.
      const payments = await tx.payment.findMany({ where: { saleId: sale.id } });
      const wasCredit = payments.some(p => p.method === 'CREDIT') || (payments.length === 0 && sale.status !== 'DRAFT' && sale.status !== 'SUSPENDED');
      if (wasCredit && sale.customerId && balanceDelta > 0) {
        await tx.contact.update({
          where: { id: sale.customerId },
          data: { balance: { decrement: balanceDelta } }
        });
      }

      // Track D auto-posting, increment 3: reverse the cash DEBIT finalize
      // posted, using the same balanceDelta already computed above rather than
      // looking up the original transaction (AccountTransaction has no saleId
      // link - see TRACE.md). Only when a real payment happened (!wasCredit,
      // payments.length > 0) - a credit sale never posted a cash DEBIT in the
      // first place, so there is nothing to reverse.
      if (!wasCredit && payments.length > 0 && balanceDelta > 0) {
        const account = await getOrCreateCashAccount(tx, companyId, sale.locationId);
        await postCashTransaction(tx, account, 'CREDIT', balanceDelta, `SALE-RETURN-${sale.id}`, sale.ticketNumber ?? undefined);
      }

      const requestedById = new Map(returnLines.map(({ item, quantity }) => [item.id, quantity]));
      const fullyReturned = sale.items.every(item => {
        const returned = Number(item.returnedQty ?? 0) + (requestedById.get(item.id) ?? 0);
        return returned >= Number(item.quantity);
      });
      const anyReturned = sale.items.some(item => Number(item.returnedQty ?? 0) + (requestedById.get(item.id) ?? 0) > 0);
      const nextStatus = fullyReturned ? 'RETURNED' : anyReturned ? 'PARTIALLY_RETURNED' : sale.status;

      return await tx.sale.update({
        where: { id: sale.id },
        data: { status: nextStatus },
        include: { items: { include: { product: true, variation: true } }, customer: true, payments: true }
      });
    });

    res.json(normalizeSale(updatedSale));
  } catch (error) {
    next(error);
  }
});

export default router;

