import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return res.json({ locations: [] });

    const locations = await prisma.location.findMany({
      where: { companyId: company.id, isActive: true },
      orderBy: { id: 'asc' }
    });

    res.json({ locations });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const parsed = z.object({
      name: z.string().min(2),
      address: z.string().optional().nullable(),
    }).parse(req.body);

    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({ data: { name: 'Demo Company' } });
    }

    const loc = await prisma.$transaction(async (tx) => {
      const created = await tx.location.create({
        data: {
          companyId: company!.id,
          name: parsed.name,
          address: parsed.address,
        }
      });
      await tx.warehouse.create({
        data: {
          companyId: company!.id,
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
