import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const warranties = await prisma.warranty.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { name: 'asc' },
    });
    res.json({ warranties });
  } catch (err) { next(err); }
});

const createSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  duration: z.coerce.number().int().positive(),
  durationType: z.enum(['DAYS', 'MONTHS', 'YEARS']).default('MONTHS'),
});

router.post('/', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createSchema.parse(req.body);
    const companyId = req.user!.companyId;
    const existing = await prisma.warranty.findFirst({
      where: { companyId, name: parsed.name },
    });
    if (existing) return res.status(409).json({ message: 'Garantie déjà existante avec ce nom' });

    const warranty = await prisma.warranty.create({
      data: {
        companyId,
        name: parsed.name,
        description: parsed.description,
        duration: parsed.duration,
        durationType: parsed.durationType,
      },
    });
    res.status(201).json({ success: true, warranty });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Garantie invalide', errors: err.issues });
    next(err);
  }
});

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  duration: z.coerce.number().int().positive().optional(),
  durationType: z.enum(['DAYS', 'MONTHS', 'YEARS']).optional(),
});

router.put('/:id', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const companyId = req.user!.companyId;
    const existing = await prisma.warranty.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: 'Garantie introuvable' });

    const parsed = updateSchema.parse(req.body);
    const warranty = await prisma.warranty.update({
      where: { id },
      data: {
        name: parsed.name,
        description: parsed.description,
        duration: parsed.duration,
        durationType: parsed.durationType,
      },
    });
    res.json({ success: true, warranty });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Garantie invalide', errors: err.issues });
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const companyId = req.user!.companyId;
    const existing = await prisma.warranty.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: 'Garantie introuvable' });

    await prisma.warranty.delete({ where: { id } });
    res.json({ success: true, message: 'Garantie supprimée' });
  } catch (err) { next(err); }
});

export default router;
