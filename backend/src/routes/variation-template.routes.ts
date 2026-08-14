import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const templates = await prisma.variationTemplate.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { name: 'asc' },
    });
    res.json({ templates });
  } catch (err) { next(err); }
});

const createSchema = z.object({
  name: z.string().trim().min(1),
  values: z.array(z.string().trim().min(1)).min(1),
});

router.post('/', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createSchema.parse(req.body);
    const companyId = req.user!.companyId;
    const existing = await prisma.variationTemplate.findFirst({
      where: { companyId, name: parsed.name },
    });
    if (existing) return res.status(409).json({ message: 'Modèle de variation déjà existant' });

    const template = await prisma.variationTemplate.create({
      data: {
        companyId,
        name: parsed.name,
        values: parsed.values,
      },
    });
    res.status(201).json({ success: true, template });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Modèle invalide', errors: err.issues });
    next(err);
  }
});

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  values: z.array(z.string().trim().min(1)).min(1).optional(),
});

router.put('/:id', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const companyId = req.user!.companyId;
    const existing = await prisma.variationTemplate.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: 'Modèle introuvable' });

    const parsed = updateSchema.parse(req.body);
    const template = await prisma.variationTemplate.update({
      where: { id },
      data: {
        name: parsed.name,
        values: parsed.values,
      },
    });
    res.json({ success: true, template });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Modèle invalide', errors: err.issues });
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const companyId = req.user!.companyId;
    const existing = await prisma.variationTemplate.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: 'Modèle introuvable' });

    await prisma.variationTemplate.delete({ where: { id } });
    res.json({ success: true, message: 'Modèle supprimé' });
  } catch (err) { next(err); }
});

export default router;
