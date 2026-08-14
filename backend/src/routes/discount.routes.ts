import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

const asNumber = (value: unknown) => value && typeof value === 'object' && 'toNumber' in value
  ? (value as { toNumber: () => number }).toNumber()
  : Number(value || 0);

const serialize = (discount: any) => ({ ...discount, amount: asNumber(discount.amount) });

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const discounts = await prisma.discount.findMany({
      where: { companyId: req.user!.companyId },
      include: { brand: true, category: true, location: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ discounts: discounts.map(serialize) });
  } catch (err) { next(err); }
});

const createSchema = z.object({
  name: z.string().trim().min(1),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  amount: z.coerce.number().positive(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  appliesTo: z.enum(['ALL', 'CATEGORY', 'BRAND', 'PRODUCT']).default('ALL'),
  brandId: z.coerce.number().optional().nullable(),
  categoryId: z.coerce.number().optional().nullable(),
  productIds: z.array(z.number()).optional().nullable(),
  locationId: z.coerce.number().optional().nullable(),
});

router.post('/', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createSchema.parse(req.body);
    const companyId = req.user!.companyId;

    if (parsed.brandId) {
      const b = await prisma.brand.findFirst({ where: { id: parsed.brandId, companyId } });
      if (!b) return res.status(400).json({ message: 'Marque introuvable pour ce compte' });
    }
    if (parsed.categoryId) {
      const c = await prisma.category.findFirst({ where: { id: parsed.categoryId, companyId } });
      if (!c) return res.status(400).json({ message: 'Catégorie introuvable pour ce compte' });
    }
    if (parsed.locationId) {
      const l = await prisma.location.findFirst({ where: { id: parsed.locationId, companyId } });
      if (!l) return res.status(400).json({ message: 'Magasin introuvable pour ce compte' });
    }

    const discount = await prisma.discount.create({
      data: {
        companyId,
        name: parsed.name,
        discountType: parsed.discountType,
        amount: parsed.amount,
        startDate: parsed.startDate ? new Date(parsed.startDate) : null,
        endDate: parsed.endDate ? new Date(parsed.endDate) : null,
        appliesTo: parsed.appliesTo,
        brandId: parsed.brandId,
        categoryId: parsed.categoryId,
        productIds: parsed.productIds || undefined,
        locationId: parsed.locationId,
      },
    });
    res.status(201).json({ success: true, discount: serialize(discount) });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Remise invalide', errors: err.issues });
    next(err);
  }
});

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  amount: z.coerce.number().positive().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  appliesTo: z.enum(['ALL', 'CATEGORY', 'BRAND', 'PRODUCT']).optional(),
  brandId: z.coerce.number().optional().nullable(),
  categoryId: z.coerce.number().optional().nullable(),
  productIds: z.array(z.number()).optional().nullable(),
  locationId: z.coerce.number().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.put('/:id', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const companyId = req.user!.companyId;
    const existing = await prisma.discount.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: 'Remise introuvable' });

    const parsed = updateSchema.parse(req.body);

    if (parsed.brandId) {
      const b = await prisma.brand.findFirst({ where: { id: parsed.brandId, companyId } });
      if (!b) return res.status(400).json({ message: 'Marque introuvable pour ce compte' });
    }
    if (parsed.categoryId) {
      const c = await prisma.category.findFirst({ where: { id: parsed.categoryId, companyId } });
      if (!c) return res.status(400).json({ message: 'Catégorie introuvable pour ce compte' });
    }
    if (parsed.locationId) {
      const l = await prisma.location.findFirst({ where: { id: parsed.locationId, companyId } });
      if (!l) return res.status(400).json({ message: 'Magasin introuvable pour ce compte' });
    }

    const discount = await prisma.discount.update({
      where: { id },
      data: {
        name: parsed.name,
        discountType: parsed.discountType,
        amount: parsed.amount,
        startDate: parsed.startDate !== undefined ? (parsed.startDate ? new Date(parsed.startDate) : null) : undefined,
        endDate: parsed.endDate !== undefined ? (parsed.endDate ? new Date(parsed.endDate) : null) : undefined,
        appliesTo: parsed.appliesTo,
        brandId: parsed.brandId,
        categoryId: parsed.categoryId,
        productIds: parsed.productIds !== undefined ? (parsed.productIds || undefined) : undefined,
        locationId: parsed.locationId,
        isActive: parsed.isActive,
      },
    });
    res.json({ success: true, discount: serialize(discount) });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Remise invalide', errors: err.issues });
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const companyId = req.user!.companyId;
    const existing = await prisma.discount.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: 'Remise introuvable' });

    await prisma.discount.delete({ where: { id } });
    res.json({ success: true, message: 'Remise supprimée' });
  } catch (err) { next(err); }
});

export default router;
