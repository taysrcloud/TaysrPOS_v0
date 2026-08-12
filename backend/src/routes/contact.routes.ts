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

export default router;
