import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getOrCreateCashAccount, postCashTransaction } from '../utils/accounting.js';

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

const expenseEditSchema = expenseSchema.extend({
  isActive: z.coerce.boolean().default(true),
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;

    const expenses = await prisma.expense.findMany({
      where: { companyId },
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

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = expenseSchema.parse(req.body);
    const companyId = req.user!.companyId;
    if (parsed.locationId) {
      const location = await prisma.location.findFirst({ where: { id: parsed.locationId, companyId } });
      if (!location) return res.status(400).json({ message: 'Magasin invalide' });
    }

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          companyId,
          locationId: parsed.locationId,
          reference: parsed.reference || `EXP-${Math.floor(Math.random() * 10000)}`,
          category: parsed.category,
          amount: parsed.amount,
          date: new Date(parsed.date),
          note: parsed.note,
          paymentMethod: parsed.paymentMethod,
        }
      });

      // Track D auto-posting: an expense with paymentMethod 'CREDIT' hasn't
      // actually been paid in cash yet (same convention as Sale's CREDIT
      // method) - no cash left the account, so nothing to post.
      if (parsed.paymentMethod !== 'CREDIT') {
        const account = await getOrCreateCashAccount(tx, companyId, parsed.locationId);
        await postCashTransaction(tx, account, 'CREDIT', parsed.amount, `EXPENSE-${created.id}`, parsed.category);
      }

      return created;
    });

    res.json({ success: true, expense });
  } catch (err) {
    next(err);
  }
});

// Note: editing an expense (amount, paymentMethod, or isActive/deactivation)
// does NOT adjust any AccountTransaction posted when it was created. Reconciling
// an edit means reversing the old posted amount and posting the new one (or
// skipping if paymentMethod moved to/from CREDIT) - deliberately out of scope
// for this increment, a known gap, not a silent omission.
router.put('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const expenseId = Number(req.params.id);
    if (!Number.isInteger(expenseId) || expenseId <= 0) {
      return res.status(400).json({ message: 'Depense invalide' });
    }

    const existing = await prisma.expense.findFirst({ where: { id: expenseId, companyId } });
    if (!existing) return res.status(404).json({ message: 'Depense introuvable' });

    const parsed = expenseEditSchema.parse(req.body);
    if (parsed.locationId) {
      const location = await prisma.location.findFirst({ where: { id: parsed.locationId, companyId } });
      if (!location) return res.status(400).json({ message: 'Magasin invalide' });
    }

    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        locationId: parsed.locationId,
        reference: parsed.reference || existing.reference,
        category: parsed.category,
        amount: parsed.amount,
        date: new Date(parsed.date),
        note: parsed.note,
        paymentMethod: parsed.paymentMethod,
        isActive: parsed.isActive,
      },
    });

    res.json({ success: true, expense: { ...expense, amount: Number(expense.amount), date: expense.date.toISOString().split('T')[0] } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Depense invalide', errors: err.issues });
    next(err);
  }
});

export default router;
