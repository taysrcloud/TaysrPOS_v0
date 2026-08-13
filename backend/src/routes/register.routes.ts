import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { getOrCreateCashAccount, postCashTransaction } from '../utils/accounting.js';

const router = Router();

router.get('/sessions', requireAuth, async (req: any, res, next) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.json({ sessions: [] });

    const sessions = await prisma.cashRegisterSession.findMany({
      where: { companyId },
      include: { user: true },
      orderBy: { openedAt: 'desc' }
    });

    const mapped = sessions.map(s => ({
      id: s.id,
      userId: s.userId,
      openedAt: s.openedAt.toISOString().replace('T', ' ').substring(0, 16),
      // Full, untruncated ISO timestamp - the display-formatted openedAt above
      // (space-separated, minute precision) is not safe to compare against a
      // sale's own createdAtISO for shift-boundary purposes: at minimum it
      // truncates precision, and 'T' vs ' ' as the date/time separator sorts
      // differently in a naive string comparison. See TRACE.md's Z-report
      // shift-boundary entry.
      openedAtISO: s.openedAt.toISOString(),
      closedAt: s.closedAt ? s.closedAt.toISOString().replace('T', ' ').substring(0, 16) : null,
      cashierName: s.user.fullName,
      initialCash: Number(s.openingCash),
      expectedCash: Number(s.expectedCash),
      actualCash: s.countedCash ? Number(s.countedCash) : null,
      difference: s.difference ? Number(s.difference) : 0,
      status: s.closedAt ? (Number(s.difference) === 0 ? 'Juste' : Number(s.difference) > 0 ? 'Ecart positif' : 'Ecart negatif') : 'Ouverte',
      locationId: s.locationId
    }));

    res.json({ sessions: mapped });
  } catch (err) {
    next(err);
  }
});

router.post('/open', requireAuth, async (req: any, res, next) => {
  console.log("HELLO FROM OPEN ROUTE!");
  try {
    const parsed = z.object({
      initialCash: z.coerce.number().min(0),
      locationId: z.number().optional().nullable()
    }).parse(req.body);

    const companyId = req.user.companyId;
    const userId = req.user.userId;

    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: {
        companyId,
        userId,
        locationId: parsed.locationId ?? null,
        closedAt: null,
      },
      orderBy: { openedAt: 'desc' }
    });

    if (activeSession) {
      return res.status(409).json({ message: 'Une caisse est deja ouverte pour cet utilisateur sur cet emplacement.', session: activeSession });
    }

    const session = await prisma.cashRegisterSession.create({
      data: {
        companyId,
        userId,
        locationId: parsed.locationId,
        openingCash: parsed.initialCash,
      }
    });

    res.json({ success: true, session });
  } catch (err) {
    console.error("DEBUG /open err:", err);
    next(err);
  }
});

router.post('/close', requireAuth, async (req: any, res, next) => {
  try {
    const parsed = z.object({
      sessionId: z.number(),
      countedCash: z.coerce.number().min(0),
      expectedCash: z.coerce.number()
    }).parse(req.body);

    const existingSession = await prisma.cashRegisterSession.findFirst({
      where: { id: parsed.sessionId, companyId: req.user.companyId }
    });

    if (!existingSession) {
      return res.status(404).json({ message: 'Session introuvable' });
    }

    const difference = parsed.countedCash - parsed.expectedCash;

    const session = await prisma.cashRegisterSession.update({
      where: { id: parsed.sessionId },
      data: {
        closedAt: new Date(),
        countedCash: parsed.countedCash,
        expectedCash: parsed.expectedCash,
        difference
      }
    });

    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

router.get('/movements', requireAuth, async (req: any, res, next) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.json({ movements: [] });

    const movements = await prisma.cashMovement.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });

    const mapped = movements.map(m => ({
      id: m.id,
      type: m.type,
      amount: Number(m.amount),
      note: m.note || '',
      time: m.createdAt.toISOString().replace('T', ' ').substring(0, 16),
      locationId: m.locationId,
      sessionId: m.sessionId
    }));

    res.json({ movements: mapped });
  } catch (err) {
    next(err);
  }
});

router.post('/movements', requireAuth, async (req: any, res, next) => {
  try {
    const parsed = z.object({
      type: z.enum(['IN', 'OUT']),
      amount: z.coerce.number().min(0),
      note: z.string().optional().nullable(),
      locationId: z.number().optional().nullable(),
      sessionId: z.number().optional().nullable(),
    }).parse(req.body);

    const companyId = req.user.companyId;

    const movement = await prisma.$transaction(async (tx) => {
      const created = await tx.cashMovement.create({
        data: {
          companyId,
          type: parsed.type,
          amount: parsed.amount,
          note: parsed.note,
          locationId: parsed.locationId,
          sessionId: parsed.sessionId
        }
      });

      // Track D auto-posting: a cash movement IS a cash-drawer event by
      // definition, no payment-method ambiguity to check like Sale/Expense.
      const account = await getOrCreateCashAccount(tx, companyId, parsed.locationId);
      await postCashTransaction(tx, account, parsed.type === 'IN' ? 'DEBIT' : 'CREDIT', parsed.amount, `CASHMOVEMENT-${created.id}`, parsed.note ?? undefined);

      return created;
    });

    res.json({ success: true, movement });
  } catch (err) {
    next(err);
  }
});

export default router;
