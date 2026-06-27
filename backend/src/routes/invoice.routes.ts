import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const invoiceSchema = z.object({
  customerId: z.coerce.number().int().positive().optional(),
  saleIds: z.array(z.coerce.number().int().positive()).default([]),
  notes: z.string().optional(),
  mode: z.enum(['FROM_TICKETS', 'MANUAL']).default('FROM_TICKETS'),
  displayMode: z.enum(['SUMMARY', 'DETAILED']).optional(),
  manualLines: z.array(z.object({
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().min(0),
    tvaRate: z.coerce.number().min(0).max(100).default(20),
  })).default([]),
});

router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const companyId = req.user.companyId;
    const invoices = await prisma.invoice.findMany({
      where: { companyId },
      include: {
        customer: true,
        sales: {
          include: { items: { include: { product: true, variation: true } } }
        }
      },
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

      subtotal = manualLines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
      taxTotal = manualLines.reduce((sum, line) => sum + (line.quantity * line.unitPrice * line.tvaRate / 100), 0);
      total = subtotal + taxTotal;
    }

    const metadata = JSON.stringify({
      userNote: notes || '',
      mode,
      displayMode: displayMode || 'SUMMARY',
      manualLines: mode === 'MANUAL' ? manualLines : [],
    });

    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        number,
        customerId: customerId || null,
        subtotal,
        taxTotal,
        total,
        notes: metadata,
        ...(mode === 'FROM_TICKETS' ? { sales: { connect: saleIds.map(id => ({ id })) } } : {}),
      },
      include: {
        customer: true,
        sales: {
          include: { items: { include: { product: true, variation: true } } }
        }
      }
    });

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ message: 'Erreur lors de la creation de la facture' });
  }
});

export default router;
