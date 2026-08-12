import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

// Track C (catalog/pricing depth): CustomerGroup + SellingPriceGroup + per-product
// price overrides. CRUD only in this pass - resolving a customer's group price
// into the POS cart is register-adjacent and deferred (see schema.prisma comment).
const router = Router();

const asNumber = (value: unknown) => value && typeof value === 'object' && 'toNumber' in value
  ? (value as { toNumber: () => number }).toNumber()
  : Number(value || 0);

router.get('/groups', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const groups = await prisma.sellingPriceGroup.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

router.post('/groups', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const parsed = z.object({ name: z.string().trim().min(2) }).parse(req.body);
    const group = await prisma.sellingPriceGroup.create({ data: { companyId, name: parsed.name } });
    res.status(201).json({ success: true, group });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Groupe de prix invalide', errors: err.issues });
    next(err);
  }
});

router.put('/groups/:id/prices', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const groupId = Number(req.params.id);
    const group = await prisma.sellingPriceGroup.findFirst({ where: { id: groupId, companyId } });
    if (!group) return res.status(404).json({ message: 'Groupe de prix introuvable' });

    const parsed = z.object({ productId: z.coerce.number().int().positive(), price: z.coerce.number().min(0) }).parse(req.body);
    const product = await prisma.product.findFirst({ where: { id: parsed.productId, companyId } });
    if (!product) return res.status(404).json({ message: 'Produit introuvable' });

    const price = await prisma.productGroupPrice.upsert({
      where: { productId_priceGroupId: { productId: parsed.productId, priceGroupId: groupId } },
      update: { price: parsed.price },
      create: { productId: parsed.productId, priceGroupId: groupId, price: parsed.price },
    });
    res.json({ success: true, price: { ...price, price: asNumber(price.price) } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Prix invalide', errors: err.issues });
    next(err);
  }
});

router.get('/customer-groups', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const groups = await prisma.customerGroup.findMany({
      where: { companyId },
      include: { priceGroup: true },
      orderBy: { name: 'asc' },
    });
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

router.post('/customer-groups', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const parsed = z.object({
      name: z.string().trim().min(2),
      priceGroupId: z.coerce.number().int().positive().optional().nullable(),
    }).parse(req.body);

    if (parsed.priceGroupId) {
      const priceGroup = await prisma.sellingPriceGroup.findFirst({ where: { id: parsed.priceGroupId, companyId } });
      if (!priceGroup) return res.status(400).json({ message: 'Groupe de prix invalide' });
    }

    const group = await prisma.customerGroup.create({
      data: { companyId, name: parsed.name, priceGroupId: parsed.priceGroupId || null },
    });
    res.status(201).json({ success: true, group });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Groupe client invalide', errors: err.issues });
    next(err);
  }
});

export default router;
