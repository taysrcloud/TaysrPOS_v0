import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.post('/clock-in', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;
    const open = await prisma.attendance.findFirst({ where: { companyId, userId, clockOut: null }, orderBy: { clockIn: 'desc' } });
    if (open) return res.status(409).json({ error: 'Une entree est deja ouverte', attendance: open });
    const attendance = await prisma.attendance.create({ data: { companyId, userId } });
    res.status(201).json({ attendance });
  } catch (error) { next(error); }
});

router.post('/clock-out', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;
    const open = await prisma.attendance.findFirst({ where: { companyId, userId, clockOut: null }, orderBy: { clockIn: 'desc' } });
    if (!open) return res.status(404).json({ error: 'Aucune entree ouverte' });
    const clockOut = new Date();
    const duration = Math.max(0, (clockOut.getTime() - open.clockIn.getTime()) / 3600000);
    const attendance = await prisma.attendance.update({ where: { id: open.id }, data: { clockOut, duration } });
    res.json({ attendance });
  } catch (error) { next(error); }
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const attendance = await prisma.attendance.findMany({ where: { companyId }, orderBy: { clockIn: 'desc' }, take: 100 });
    res.json({ attendance });
  } catch (error) { next(error); }
});

export default router;
