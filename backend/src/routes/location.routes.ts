import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req: any, res, next) => {
  try {
    const companyId = req.user.companyId;

    const locations = await prisma.location.findMany({
      where: { companyId, isActive: true },
      orderBy: { id: 'asc' }
    });

    res.json({ locations });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole(['ADMIN']), async (req: any, res: any, next: any) => {
  try {
    if (req.user.planLimits && req.user.planLimits.maxLocations !== null && req.user.planLimits.maxLocations !== undefined) {
      const locationCount = await prisma.warehouse.count({ where: { companyId: req.user.companyId } });
      if (locationCount >= req.user.planLimits.maxLocations) {
        return res.status(403).json({ message: 'Limite de magasins atteinte pour votre abonnement.' });
      }
    }

    const parsed = z.object({
      name: z.string().min(2),
      address: z.string().optional().nullable(),
    }).parse(req.body);

    const companyId = req.user.companyId;

    const loc = await prisma.$transaction(async (tx) => {
      const created = await tx.location.create({
        data: {
          companyId,
          name: parsed.name,
          address: parsed.address,
        }
      });
      await tx.warehouse.create({
        data: {
          companyId,
          locationId: created.id,
          name: `Magasin ${parsed.name}`,
          isMain: false
        }
      });
      return created;
    });
    
    res.json({ success: true, location: loc });
  } catch (err) {
    next(err);
  }
});

export default router;
