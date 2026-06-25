import { Router } from 'express';
import { prisma } from '../utils/prisma.js';

const router = Router();

router.get('/tables', async (req, res, next) => {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return res.json({ areas: [] });

    // Seed some basic areas if none exist for demo purposes
    let areas = await prisma.restaurantArea.findMany({
      where: { companyId: company.id },
      include: { tables: true }
    });

    if (areas.length === 0) {
      const area1 = await prisma.restaurantArea.create({
        data: {
          companyId: company.id,
          name: 'Salle Principale',
          tables: {
            create: Array.from({ length: 8 }).map((_, i) => ({ companyId: company.id, name: `Salle ${i + 1}`, seats: 4 }))
          }
        },
        include: { tables: true }
      });
      const area2 = await prisma.restaurantArea.create({
        data: {
          companyId: company.id,
          name: 'Terrasse',
          tables: {
            create: Array.from({ length: 6 }).map((_, i) => ({ companyId: company.id, name: `Terrasse ${i + 1}`, seats: 4 }))
          }
        },
        include: { tables: true }
      });
      
      const newAreas = [area1, area2];
      
      const formattedAreas = newAreas.map(area => ({
        id: area.id,
        name: area.name,
        tables: area.tables.map(t => ({
          id: t.id,
          name: t.name,
          seats: t.seats,
          isActive: t.isActive
        }))
      }));
      return res.json({ areas: formattedAreas });
    }

    const formattedAreas = areas.map(area => ({
      id: area.id,
      name: area.name,
      tables: area.tables.map(t => ({
        id: t.id,
        name: t.name,
        seats: t.seats,
        isActive: t.isActive
      }))
    }));

    res.json({ areas: formattedAreas });
  } catch (error) {
    next(error);
  }
});

export default router;
