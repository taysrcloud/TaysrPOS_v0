import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

const contactSchema = z.object({
  type: z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']).default('CUSTOMER'),
  fullName: z.string().trim().min(2),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  ice: z.string().optional().nullable(),
  creditLimit: z.coerce.number().min(0).default(0),
  balance: z.coerce.number().default(0),
});

// Same fields as create, minus balance (never edited directly - it's a derived ledger
// value, not a form field) and with isActive for the soft-deactivate toggle.
const contactEditSchema = contactSchema.omit({ balance: true }).extend({
  isActive: z.coerce.boolean().default(true),
});

const toContactResponse = (contact: {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  type: string;
  balance: unknown;
  creditLimit: unknown;
  address: string | null;
  ice: string | null;
  isActive: boolean;
  createdAt: Date;
}) => ({
  id: contact.id,
  name: contact.fullName,
  phone: contact.phone || '',
  email: contact.email || '',
  type: contact.type,
  balance: Number(contact.balance),
  creditLimit: Number(contact.creditLimit),
  lastActivity: contact.createdAt.toISOString(),
  rewardPoints: 0,
  storeCredit: 0,
  address: contact.address || '',
  taxId: contact.ice || '',
  isActive: contact.isActive,
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;

    const contacts = await prisma.contact.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });
    
    const mapped = contacts.map(toContactResponse);

    res.json({ contacts: mapped });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = contactSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const contact = await prisma.contact.create({
      data: {
        companyId,
        ...parsed
      }
    });

    res.status(201).json({ success: true, contact: toContactResponse(contact) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const contactId = Number(req.params.id);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return res.status(400).json({ message: 'Contact invalide' });
    }

    const existing = await prisma.contact.findFirst({ where: { id: contactId, companyId } });
    if (!existing) return res.status(404).json({ message: 'Contact introuvable' });

    const parsed = contactEditSchema.parse(req.body);
    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: parsed,
    });

    res.json({ success: true, contact: toContactResponse(contact) });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Contact invalide', errors: err.issues });
    next(err);
  }
});

const asNumber = (value: unknown) => value && typeof value === 'object' && 'toNumber' in value
  ? (value as { toNumber: () => number }).toNumber()
  : Number(value || 0);

// Unified ledger for both roles of a contact (CUSTOMER/SUPPLIER/BOTH): purchase
// history for suppliers, sales + invoice history for customers, current balance
// either way. Read-only, additive - no existing route depends on this shape.
router.get('/:id/ledger', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const contactId = Number(req.params.id);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return res.status(400).json({ message: 'Contact invalide' });
    }

    const contact = await prisma.contact.findFirst({ where: { id: contactId, companyId } });
    if (!contact) return res.status(404).json({ message: 'Contact introuvable' });

    const isSupplier = contact.type === 'SUPPLIER' || contact.type === 'BOTH';
    const isCustomer = contact.type === 'CUSTOMER' || contact.type === 'BOTH';

    const [purchases, sales, invoices] = await Promise.all([
      isSupplier
        ? prisma.purchase.findMany({
            where: { companyId, supplierId: contactId },
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        : Promise.resolve([]),
      isCustomer
        ? prisma.sale.findMany({
            where: { companyId, customerId: contactId },
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        : Promise.resolve([]),
      isCustomer
        ? prisma.invoice.findMany({
            where: { companyId, customerId: contactId },
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        : Promise.resolve([]),
    ]);

    res.json({
      contact: toContactResponse(contact),
      purchases: purchases.map(p => ({
        id: p.id,
        reference: p.reference,
        total: asNumber(p.total),
        status: p.status,
        date: p.createdAt.toISOString(),
      })),
      sales: sales.map(s => ({
        id: s.id,
        ticket: s.ticketNumber || `TCK-${String(s.id).padStart(4, '0')}`,
        total: asNumber(s.total),
        status: s.status,
        paymentStatus: s.paymentStatus,
        date: s.createdAt.toISOString(),
      })),
      invoices: invoices.map(inv => ({
        id: inv.id,
        number: inv.number,
        total: asNumber(inv.total),
        status: inv.status,
        date: inv.createdAt.toISOString(),
        dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
