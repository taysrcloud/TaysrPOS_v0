import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req: any, res, next) => {
  try {
    const companyId = req.user.companyId;

    const purchases = await prisma.purchase.findMany({
      where: { companyId },
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' }
    });

    const mapped = purchases.map(p => ({
      id: p.id,
      reference: p.reference,
      supplier: p.supplier?.fullName || 'Inconnu',
      total: Number(p.total),
      status: p.status,
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
      status: z.enum(['PENDING', 'RECEIVED']).default('RECEIVED'),
      items: z.array(z.object({
        productId: z.number(),
        quantity: z.number(),
        unitCost: z.number()
      })),
      total: z.number()
    }).parse(req.body);

    const companyId = (req as any).user.companyId;
    const productIds = [...new Set(parsed.items.map(item => item.productId))];
    const ownedProducts = await prisma.product.count({ where: { companyId, id: { in: productIds } } });
    if (ownedProducts !== productIds.length) return res.status(404).json({ error: 'Produit introuvable' });
    if (parsed.supplierId) {
      const supplier = await prisma.contact.findFirst({ where: { id: parsed.supplierId, companyId, type: { in: ['SUPPLIER', 'BOTH'] } } });
      if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable' });
    }
    if (parsed.locationId) {
      const location = await prisma.location.findFirst({ where: { id: parsed.locationId, companyId } });
      if (!location) return res.status(404).json({ error: 'Magasin introuvable' });
    }

    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          companyId,
          supplierId: parsed.supplierId,
          reference: `ACH-${Math.floor(Math.random() * 10000)}`,
          total: parsed.total,
          status: parsed.status,
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

      if (parsed.status === 'RECEIVED') {
        let warehouse = await tx.warehouse.findFirst({
          where: parsed.locationId ? { companyId, locationId: parsed.locationId } : { companyId }
        });

        if (!warehouse) {
          warehouse = await tx.warehouse.create({
            data: { companyId, name: 'Magasin principal', isMain: true }
          });
        }

        for (const item of parsed.items) {
          await tx.productStock.upsert({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: warehouse.id } } as any,
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
        
        if (parsed.supplierId) {
          await tx.contact.update({
            where: { id: parsed.supplierId },
            data: { balance: { increment: parsed.total } }
          });
        }
      }

      return created;
    });

    res.json({ success: true, purchase });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/receive', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = z.object({
      locationId: z.coerce.number().int().positive().optional()
    }).parse(req.body);

    const companyId = (req as any).user.companyId;
    const purchase = await prisma.purchase.findFirst({
      where: { id: Number(id), companyId },
      include: { items: true }
    });

    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    if (purchase.status === 'RECEIVED') return res.status(400).json({ error: 'Purchase is already received' });

    let warehouse = await prisma.warehouse.findFirst({
      where: parsed.locationId ? { companyId, locationId: parsed.locationId } : { companyId }
    });

    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: { companyId, name: 'Magasin principal', isMain: true }
      });
    }

    await prisma.$transaction(async (tx) => {
      // Mark as received
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: 'RECEIVED' }
      });

      // Update supplier balance if needed
      if (purchase.supplierId) {
        await tx.contact.update({
          where: { id: purchase.supplierId },
          data: { balance: { increment: purchase.total } }
        });
      }

      for (const item of purchase.items) {
        await tx.productStock.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: warehouse!.id } } as any,
          update: { quantity: { increment: item.quantity } },
          create: { productId: item.productId, warehouseId: warehouse!.id, quantity: item.quantity },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: warehouse!.id,
            type: 'IN',
            quantity: item.quantity,
            reference: purchase.reference,
          }
        });
      }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
