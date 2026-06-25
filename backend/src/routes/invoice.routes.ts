import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const invoiceSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  saleIds: z.array(z.coerce.number().int().positive()).min(1),
  notes: z.string().optional(),
});

// Get all invoices
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
    res.status(500).json({ message: 'Erreur lors de la récupération des factures' });
  }
});

// Create invoice from tickets
router.post('/', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: any, res: any) => {
  try {
    const companyId = req.user.companyId;
    const parsed = invoiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Données invalides', errors: parsed.error.issues });

    const { customerId, saleIds, notes } = parsed.data;

    // Verify all sales belong to company and customer
    const sales = await prisma.sale.findMany({
      where: { companyId, id: { in: saleIds }, customerId }
    });

    if (sales.length !== saleIds.length) {
      return res.status(400).json({ message: 'Certains tickets sont introuvables ou n\'appartiennent pas à ce client' });
    }

    if (sales.some(s => s.invoiceId)) {
      return res.status(400).json({ message: 'Certains tickets sont déjà facturés' });
    }

    // Calculate totals
    const subtotal = sales.reduce((sum, s) => sum + Number(s.subtotal), 0);
    const taxTotal = sales.reduce((sum, s) => sum + Number(s.taxTotal), 0);
    const total = sales.reduce((sum, s) => sum + Number(s.total), 0);
    const number = `FAC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          companyId,
          number,
          customerId,
          subtotal,
          taxTotal,
          total,
          notes,
          sales: { connect: saleIds.map(id => ({ id })) }
        },
        include: { customer: true, sales: { include: { items: { include: { product: true, variation: true } } } } }
      });
      return inv;
    });

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ message: 'Erreur lors de la création de la facture' });
  }
});

export default router;
