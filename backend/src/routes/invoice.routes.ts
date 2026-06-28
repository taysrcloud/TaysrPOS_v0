import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

type InvoicePaymentMeta = {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  note?: string;
};

type InvoiceMeta = {
  userNote: string;
  mode: 'FROM_TICKETS' | 'MANUAL';
  displayMode: 'SUMMARY' | 'DETAILED';
  manualLines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    tvaRate?: number;
  }>;
  payments: InvoicePaymentMeta[];
};

const invoiceInclude = {
  customer: true,
  lines: {
    include: {
      product: true,
    },
    orderBy: {
      sortOrder: 'asc',
    },
  },
  sales: {
    include: {
      items: {
        include: {
          product: true,
          variation: true,
        }
      }
    }
  }
} as const;

const parseInvoiceMeta = (notes?: string | null): InvoiceMeta => {
  if (!notes) {
    return {
      userNote: '',
      mode: 'FROM_TICKETS',
      displayMode: 'SUMMARY',
      manualLines: [],
      payments: [],
    };
  }

  try {
    const parsed = JSON.parse(notes);
    return {
      userNote: typeof parsed?.userNote === 'string' ? parsed.userNote : '',
      mode: parsed?.mode === 'MANUAL' ? 'MANUAL' : 'FROM_TICKETS',
      displayMode: parsed?.displayMode === 'DETAILED' ? 'DETAILED' : 'SUMMARY',
      manualLines: Array.isArray(parsed?.manualLines) ? parsed.manualLines : [],
      payments: Array.isArray(parsed?.payments) ? parsed.payments : [],
    };
  } catch {
    return {
      userNote: notes || '',
      mode: 'FROM_TICKETS',
      displayMode: 'SUMMARY',
      manualLines: [],
      payments: [],
    };
  }
};

const serializeInvoiceMeta = (meta: InvoiceMeta) => JSON.stringify(meta);

const getInvoiceStatusFromPaidAmount = (total: number, paidAmount: number) => {
  if (paidAmount <= 0) return 'SENT' as const;
  if (paidAmount >= total) return 'PAID' as const;
  return 'PARTIAL' as const;
};

const invoiceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  tvaRate: z.coerce.number().min(0).max(100).default(20),
  productId: z.coerce.number().int().positive().optional(),
});

const invoiceSchema = z.object({
  customerId: z.coerce.number().int().positive().optional(),
  saleIds: z.array(z.coerce.number().int().positive()).default([]),
  notes: z.string().optional(),
  mode: z.enum(['FROM_TICKETS', 'MANUAL']).default('FROM_TICKETS'),
  displayMode: z.enum(['SUMMARY', 'DETAILED']).optional(),
  manualLines: z.array(invoiceLineSchema).default([]),
});

const invoiceStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'CANCELLED']),
});

const invoicePaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'CHECK', 'OTHER']).default('CASH'),
  note: z.string().max(500).optional(),
});

router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const companyId = req.user.companyId;
    const invoices = await prisma.invoice.findMany({
      where: { companyId },
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ invoices });
  } catch (error) {
    console.error('Fetch invoices error:', error);
    res.status(500).json({ message: 'Erreur lors de la recuperation des factures' });
  }
});

router.post('/', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: any, res: any) => {
  try {
    const companyId = req.user.companyId;
    const parsed = invoiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Donnees invalides', errors: parsed.error.issues });

    const { customerId, saleIds, notes, mode, displayMode, manualLines } = parsed.data;
    const number = `FAC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    let subtotal = 0;
    let taxTotal = 0;
    let total = 0;
    let manualInvoiceLines: Array<{ description: string; quantity: number; unitPrice: number; tvaRate: number; productId?: number }> = [];

    if (mode === 'FROM_TICKETS') {
      if (!customerId || saleIds.length === 0) {
        return res.status(400).json({ message: 'Client et tickets requis pour une facture depuis tickets' });
      }

      const sales = await prisma.sale.findMany({
        where: { companyId, id: { in: saleIds }, customerId }
      });

      if (sales.length !== saleIds.length) {
        return res.status(400).json({ message: 'Certains tickets sont introuvables ou n\'appartiennent pas a ce client' });
      }

      if (sales.some(s => s.invoiceId)) {
        return res.status(400).json({ message: 'Certains tickets sont deja factures' });
      }

      subtotal = sales.reduce((sum, s) => sum + Number(s.subtotal), 0);
      taxTotal = sales.reduce((sum, s) => sum + Number(s.taxTotal), 0);
      total = sales.reduce((sum, s) => sum + Number(s.total), 0);
    } else {
      if (!customerId || manualLines.length === 0) {
        return res.status(400).json({ message: 'Client et lignes requis pour une facture manuelle' });
      }

      manualInvoiceLines = manualLines.map(line => ({
        description: line.description.trim(),
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        tvaRate: Number(line.tvaRate || 0),
        ...(line.productId ? { productId: Number(line.productId) } : {}),
      })).filter(line => line.description && line.quantity > 0);

      if (manualInvoiceLines.length === 0) {
        return res.status(400).json({ message: 'Au moins une ligne facture valide est requise' });
      }

      subtotal = manualInvoiceLines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
      taxTotal = manualInvoiceLines.reduce((sum, line) => sum + (line.quantity * line.unitPrice * line.tvaRate / 100), 0);
      total = subtotal + taxTotal;
    }

    const metadata = serializeInvoiceMeta({
      userNote: notes || '',
      mode,
      displayMode: displayMode || 'SUMMARY',
      manualLines: [],
      payments: [],
    });

    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        number,
        customerId: customerId || null,
        subtotal,
        taxTotal,
        total,
        status: 'SENT',
        notes: metadata,
        ...(mode === 'FROM_TICKETS' ? { sales: { connect: saleIds.map(id => ({ id })) } } : {}),
        ...(mode === 'MANUAL' ? {
          lines: {
            create: manualInvoiceLines.map((line, index) => ({
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              tvaRate: line.tvaRate,
              lineTotal: line.quantity * line.unitPrice,
              sortOrder: index,
              ...(line.productId ? { productId: line.productId } : {}),
            }))
          }
        } : {}),
      },
      include: invoiceInclude,
    });

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ message: 'Erreur lors de la creation de la facture' });
  }
});

router.patch('/:id/status', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: any, res: any) => {
  try {
    const companyId = req.user.companyId;
    const invoiceId = Number(req.params.id);
    const parsed = invoiceStatusSchema.safeParse(req.body);

    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ message: 'Facture invalide' });
    }

    if (!parsed.success) {
      return res.status(400).json({ message: 'Donnees invalides', errors: parsed.error.issues });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Facture introuvable' });
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: parsed.data.status },
      include: invoiceInclude,
    });

    res.json({ invoice: updated });
  } catch (error) {
    console.error('Update invoice status error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise a jour du statut facture' });
  }
});

router.post('/:id/payments', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: any, res: any) => {
  try {
    const companyId = req.user.companyId;
    const invoiceId = Number(req.params.id);
    const parsed = invoicePaymentSchema.safeParse(req.body);

    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ message: 'Facture invalide' });
    }

    if (!parsed.success) {
      return res.status(400).json({ message: 'Donnees invalides', errors: parsed.error.issues });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Facture introuvable' });
    }

    if (invoice.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Impossible d enregistrer un paiement sur une facture annulee' });
    }

    const meta = parseInvoiceMeta(invoice.notes);
    const total = Number(invoice.total || 0);
    const existingPaidAmount = meta.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const amount = Number(parsed.data.amount || 0);
    const remainingBefore = Math.max(0, total - existingPaidAmount);

    if (amount > remainingBefore) {
      return res.status(400).json({ message: `Le montant depasse le reste a regler (${remainingBefore.toFixed(2)} MAD).` });
    }

    const updatedPayments: InvoicePaymentMeta[] = [
      ...meta.payments,
      {
        id: `invpay-${Date.now()}`,
        amount,
        method: parsed.data.method,
        paidAt: new Date().toISOString(),
        note: parsed.data.note?.trim() || '',
      }
    ];

    const paidAmount = updatedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const nextStatus = getInvoiceStatusFromPaidAmount(total, paidAmount);

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: nextStatus,
        notes: serializeInvoiceMeta({
          ...meta,
          payments: updatedPayments,
          manualLines: [],
        }),
      },
      include: invoiceInclude,
    });

    res.json({ invoice: updated });
  } catch (error) {
    console.error('Record invoice payment error:', error);
    res.status(500).json({ message: 'Erreur lors de l enregistrement du paiement facture' });
  }
});

export default router;
