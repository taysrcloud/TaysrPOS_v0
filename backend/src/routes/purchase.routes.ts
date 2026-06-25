import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return res.json({ purchases: [] });

    const purchases = await prisma.purchase.findMany({
      where: { companyId: company.id },
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' }
    });

    const mapped = purchases.map(p => ({
      id: p.id,
      reference: p.reference,
      supplier: p.supplier?.fullName || 'Inconnu',
      total: Number(p.total),
      status: 'Livrée',
      date: p.createdAt.toISOString().split('T')[0],
      items: p.items.length,
    }));

    res.json({ purchases: mapped });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const parsed = z.object({
      supplierId: z.number().optional().nullable(),
      locationId: z.coerce.number().int().positive().optional(),
      items: z.array(z.object({
        productId: z.number(),
        quantity: z.number(),
        unitCost: z.number()
      })),
      total: z.number()
    }).parse(req.body);

    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({ data: { name: 'Demo Company' } });
    }

    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          companyId: company!.id,
          supplierId: parsed.supplierId,
          reference: `ACH-${Math.floor(Math.random() * 10000)}`,
          total: parsed.total,
          items: {
            create: parsed.items.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              unitCost: i.unitCost,
              lineTotal: i.quantity * i.unitCost
            }))
          }
        }
      });

      let warehouse = await tx.warehouse.findFirst({
        where: parsed.locationId ? { companyId: company!.id, locationId: parsed.locationId } : { companyId: company!.id }
      });

      if (!warehouse) {
        warehouse = await tx.warehouse.create({
          data: { companyId: company!.id, name: 'Magasin principal', isMain: true }
        });
      }

      for (const item of parsed.items) {
        await tx.productStock.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: warehouse.id } },
          update: { quantity: { increment: item.quantity } },
          create: { productId: item.productId, warehouseId: warehouse.id, quantity: item.quantity },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: warehouse.id,
            type: 'IN',
            quantity: item.quantity,
            reference: created.reference,
          }
        });
      }

      return created;
    });

    res.json({ success: true, purchase });
  } catch (err) {
    next(err);
  }
});

export default router;
