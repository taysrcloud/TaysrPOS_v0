import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

const requireRestaurant = async (req: AuthRequest, res: any) => {
  const companyId = req.user!.companyId;
  const company = await prisma.company.findFirst({ where: { id: companyId, restaurantEnabled: true } });
  if (!company) {
    res.status(403).json({ message: 'Module restaurant non active' });
    return null;
  }
  return companyId;
};

router.get('/tables', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = await requireRestaurant(req, res);
    if (!companyId) return;
    const areas = await prisma.restaurantArea.findMany({
      where: { companyId },
      include: { tables: { where: { companyId }, orderBy: { name: 'asc' } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ areas: areas.map(area => ({ id: area.id, name: area.name, tables: area.tables })) });
  } catch (error) { next(error); }
});

router.post('/areas', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const companyId = await requireRestaurant(req, res);
    if (!companyId) return;
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Nom requis' });
    const area = await prisma.restaurantArea.create({ data: { name, companyId }, include: { tables: true } });
    res.status(201).json(area);
  } catch (error) { next(error); }
});

router.post('/areas/:areaId/tables', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const companyId = await requireRestaurant(req, res);
    if (!companyId) return;
    const areaId = Number(req.params.areaId);
    const area = await prisma.restaurantArea.findFirst({ where: { id: areaId, companyId } });
    if (!area) return res.status(404).json({ message: 'Zone introuvable' });
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Nom requis' });
    const table = await prisma.restaurantTable.create({ data: { name, seats: Number(req.body.seats) || 2, areaId, companyId } });
    res.status(201).json(table);
  } catch (error) { next(error); }
});

router.delete('/tables/:id', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const companyId = await requireRestaurant(req, res);
    if (!companyId) return;
    const id = Number(req.params.id);
    const table = await prisma.restaurantTable.findFirst({ where: { id, companyId } });
    if (!table) return res.status(404).json({ message: 'Table introuvable' });
    await prisma.restaurantTable.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

export default router;
