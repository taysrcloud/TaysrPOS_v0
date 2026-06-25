import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';

const router = Router();

const expenseSchema = z.object({
  locationId: z.number().optional().nullable(),
  reference: z.string().optional().nullable(),
  category: z.string(),
  amount: z.coerce.number().min(0),
  date: z.string(),
  note: z.string().optional().nullable(),
  paymentMethod: z.string().default('CASH'),
});

router.get('/', async (req, res, next) => {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return res.json({ expenses: [] });

    const expenses = await prisma.expense.findMany({
      where: { companyId: company.id },
      orderBy: { date: 'desc' }
    });

    const mapped = expenses.map(e => ({
      ...e,
      amount: Number(e.amount),
      date: e.date.toISOString().split('T')[0]
    }));

    res.json({ expenses: mapped });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = expenseSchema.parse(req.body);
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({ data: { name: 'Demo Company' } });
    }

    const expense = await prisma.expense.create({
      data: {
        companyId: company.id,
        locationId: parsed.locationId,
        reference: parsed.reference || `EXP-${Math.floor(Math.random() * 10000)}`,
        category: parsed.category,
        amount: parsed.amount,
        date: new Date(parsed.date),
        note: parsed.note,
        paymentMethod: parsed.paymentMethod,
      }
    });

    res.json({ success: true, expense });
  } catch (err) {
    next(err);
  }
});

export default router;
