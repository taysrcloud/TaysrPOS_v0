import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';

const router = Router();

const contactSchema = z.object({
  type: z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']).default('CUSTOMER'),
  fullName: z.string().trim().min(2),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  ice: z.string().optional().nullable(),
});

router.get('/', async (req, res, next) => {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return res.json({ contacts: [] });

    const contacts = await prisma.contact.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: 'desc' }
    });
    
    const mapped = contacts.map(c => ({
      id: c.id,
      name: c.fullName,
      phone: c.phone || '',
      email: c.email || '',
      type: c.type,
      purchases: 0,
      totalSpent: 0,
      debt: Number(c.balance),
      loyaltyPoints: 0,
      address: c.address || '',
      taxId: c.ice || ''
    }));

    res.json({ contacts: mapped });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = contactSchema.parse(req.body);
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({ data: { name: 'Demo Company' } });
    }

    const contact = await prisma.contact.create({
      data: {
        companyId: company.id,
        ...parsed
      }
    });

    res.json({ success: true, contact });
  } catch (err) {
    next(err);
  }
});

export default router;
