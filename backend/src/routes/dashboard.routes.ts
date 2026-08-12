import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

// Track I (dashboard configurator): per-user widget layout, save/load only.
// The dashboard itself (renderDashboard in main.tsx) still renders its fixed
// layout - this just gives it somewhere to persist a future configurable one.
const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;
    const config = await prisma.dashboardConfiguration.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    res.json({ widgets: config?.widgets ?? [] });
  } catch (err) {
    next(err);
  }
});

router.put('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;
    const parsed = z.object({ widgets: z.array(z.record(z.string(), z.unknown())) }).parse(req.body);

    const config = await prisma.dashboardConfiguration.upsert({
      where: { companyId_userId: { companyId, userId } },
      update: { widgets: parsed.widgets as any },
      create: { companyId, userId, widgets: parsed.widgets as any },
    });
    res.json({ success: true, widgets: config.widgets });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Configuration invalide', errors: err.issues });
    next(err);
  }
});

export default router;
