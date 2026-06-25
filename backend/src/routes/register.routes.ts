import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';

const router = Router();

router.get('/sessions', async (req, res, next) => {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return res.json({ sessions: [] });

    const sessions = await prisma.cashRegisterSession.findMany({
      where: { companyId: company.id },
      include: { user: true },
      orderBy: { openedAt: 'desc' }
    });

    const mapped = sessions.map(s => ({
      id: s.id,
      openedAt: s.openedAt.toISOString().replace('T', ' ').substring(0, 16),
      closedAt: s.closedAt ? s.closedAt.toISOString().replace('T', ' ').substring(0, 16) : null,
      cashierName: s.user.fullName,
      initialCash: Number(s.openingCash),
      expectedCash: Number(s.expectedCash),
      actualCash: s.countedCash ? Number(s.countedCash) : null,
      difference: s.difference ? Number(s.difference) : 0,
      status: s.closedAt ? (Number(s.difference) === 0 ? 'Juste' : Number(s.difference) > 0 ? 'Ecart positif' : 'Ecart négatif') : 'Ouverte',
      locationId: s.locationId
    }));

    res.json({ sessions: mapped });
  } catch (err) {
    next(err);
  }
});

router.post('/open', async (req, res, next) => {
  try {
    const parsed = z.object({
      initialCash: z.coerce.number().min(0),
      locationId: z.number().optional().nullable()
    }).parse(req.body);

    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({ data: { name: 'Demo Company' } });
    }

    let user = await prisma.user.findFirst({ where: { companyId: company.id } });
    if (!user) {
      user = await prisma.user.create({ data: { companyId: company.id, username: 'admin', passwordHash: 'hash', fullName: 'Admin' } });
    }

    const session = await prisma.cashRegisterSession.create({
      data: {
        companyId: company.id,
        userId: user.id,
        locationId: parsed.locationId,
        openingCash: parsed.initialCash,
      }
    });

    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

router.post('/close', async (req, res, next) => {
  try {
    const parsed = z.object({
      sessionId: z.number(),
      countedCash: z.coerce.number().min(0),
      expectedCash: z.coerce.number()
    }).parse(req.body);

    const difference = parsed.countedCash - parsed.expectedCash;

    const session = await prisma.cashRegisterSession.update({
      where: { id: parsed.sessionId },
      data: {
        closedAt: new Date(),
        countedCash: parsed.countedCash,
        expectedCash: parsed.expectedCash,
        difference: difference
      }
    });

    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

router.get('/movements', async (req, res, next) => {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return res.json({ movements: [] });

    const movements = await prisma.cashMovement.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: 'desc' }
    });

    const mapped = movements.map(m => ({
      id: m.id,
      type: m.type,
      amount: Number(m.amount),
      note: m.note || '',
      time: m.createdAt.toISOString().replace('T', ' ').substring(0, 16),
      locationId: m.locationId
    }));

    res.json({ movements: mapped });
  } catch (err) {
    next(err);
  }
});

router.post('/movements', async (req, res, next) => {
  try {
    const parsed = z.object({
      type: z.enum(['IN', 'OUT']),
      amount: z.coerce.number().min(0),
      note: z.string().optional().nullable(),
      locationId: z.number().optional().nullable(),
      sessionId: z.number().optional().nullable(),
    }).parse(req.body);

    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({ data: { name: 'Demo Company' } });
    }

    const movement = await prisma.cashMovement.create({
      data: {
        companyId: company.id,
        type: parsed.type,
        amount: parsed.amount,
        note: parsed.note,
        locationId: parsed.locationId,
        sessionId: parsed.sessionId
      }
    });

    res.json({ success: true, movement });
  } catch (err) {
    next(err);
  }
});

export default router;
