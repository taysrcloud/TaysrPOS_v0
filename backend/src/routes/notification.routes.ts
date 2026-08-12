import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

// Track F (communications): notification templates + free-form notes/attachments.
// CRUD only - wiring templates to real events (low stock, payment received, ...)
// touches many existing action points across other routes and is deferred.
const router = Router();

router.get('/templates', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const templates = await prisma.notificationTemplate.findMany({ where: { companyId }, orderBy: { event: 'asc' } });
    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

router.post('/templates', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const parsed = z.object({
      event: z.string().trim().min(2),
      channel: z.enum(['EMAIL', 'SMS']).default('EMAIL'),
      subject: z.string().optional().nullable(),
      body: z.string().trim().min(1),
    }).parse(req.body);
    const template = await prisma.notificationTemplate.create({ data: { companyId, ...parsed } });
    res.status(201).json({ success: true, template });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Modele invalide', errors: err.issues });
    next(err);
  }
});

router.get('/notes', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const entityType = String(req.query.entityType || '');
    const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;
    if (!entityType || !entityId) return res.status(400).json({ message: 'entityType et entityId requis' });

    const notes = await prisma.documentAndNote.findMany({
      where: { companyId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ notes });
  } catch (err) {
    next(err);
  }
});

router.post('/notes', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const parsed = z.object({
      entityType: z.string().trim().min(2),
      entityId: z.coerce.number().int().positive(),
      note: z.string().optional().nullable(),
      fileUrl: z.string().optional().nullable(),
    }).parse(req.body);
    const note = await prisma.documentAndNote.create({ data: { companyId, ...parsed } });
    res.status(201).json({ success: true, note });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Note invalide', errors: err.issues });
    next(err);
  }
});

export default router;
