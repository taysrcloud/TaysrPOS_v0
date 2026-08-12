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
              lineTotal: i.quantity * i.unitCost,
              receivedQty: parsed.status === 'RECEIVED' ? i.quantity : 0
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
          const existingStock = await tx.productStock.findFirst({
            where: { productId: item.productId, warehouseId: warehouse.id, variationId: null }
          });
          if (existingStock) {
            await tx.productStock.update({ where: { id: existingStock.id }, data: { quantity: { increment: item.quantity } } });
          } else {
            await tx.productStock.create({ data: { productId: item.productId, warehouseId: warehouse.id, quantity: item.quantity } });
          }

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
      locationId: z.coerce.number().int().positive().optional(),
      // Optional per-item partial receive. Omitted (or an item omitted from the array)
      // means "receive whatever remains outstanding on that line" - preserves the
      // pre-existing full-receive behavior of this endpoint as the default.
      items: z.array(z.object({
        purchaseItemId: z.number(),
        quantity: z.number().positive()
      })).optional()
    }).parse(req.body);

    const companyId = (req as any).user.companyId;
    const purchase = await prisma.purchase.findFirst({
      where: { id: Number(id), companyId },
      include: { items: true }
    });

    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    if (purchase.status === 'RECEIVED') return res.status(400).json({ error: 'Purchase is already received' });
    if (purchase.status === 'RETURNED') return res.status(400).json({ error: 'Purchase has been returned' });

    const requestedByItemId = new Map(parsed.items?.map(i => [i.purchaseItemId, i.quantity]) ?? []);
    const receiveLines: { item: (typeof purchase.items)[number]; quantity: number }[] = [];
    for (const item of purchase.items) {
      const remaining = Number(item.quantity) - Number(item.receivedQty);
      if (remaining <= 0) continue;
      const requested = requestedByItemId.has(item.id) ? requestedByItemId.get(item.id)! : remaining;
      if (requested > remaining) return res.status(400).json({ error: `Quantite superieure au reste a recevoir pour l'article ${item.id}` });
      if (requested > 0) receiveLines.push({ item, quantity: requested });
    }

    if (receiveLines.length === 0) return res.status(400).json({ error: 'Rien a recevoir' });

    let warehouse = await prisma.warehouse.findFirst({
      where: parsed.locationId ? { companyId, locationId: parsed.locationId } : { companyId }
    });

    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: { companyId, name: 'Magasin principal', isMain: true }
      });
    }

    const supplierBalanceDelta = receiveLines.reduce((sum, { item, quantity }) => sum + quantity * Number(item.unitCost), 0);

    await prisma.$transaction(async (tx) => {
      for (const { item, quantity } of receiveLines) {
        await tx.purchaseItem.update({
          where: { id: item.id },
          data: { receivedQty: { increment: quantity } }
        });

        const existingStock = await tx.productStock.findFirst({
          where: { productId: item.productId, warehouseId: warehouse!.id, variationId: null }
        });
        if (existingStock) {
          await tx.productStock.update({ where: { id: existingStock.id }, data: { quantity: { increment: quantity } } });
        } else {
          await tx.productStock.create({ data: { productId: item.productId, warehouseId: warehouse!.id, quantity } });
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: warehouse!.id,
            type: 'IN',
            quantity,
            reference: purchase.reference,
          }
        });
      }

      if (purchase.supplierId && supplierBalanceDelta > 0) {
        await tx.contact.update({
          where: { id: purchase.supplierId },
          data: { balance: { increment: supplierBalanceDelta } }
        });
      }

      const fullyReceived = purchase.items.every(item => {
        const received = Number(item.receivedQty) + (requestedByItemId.get(item.id) ?? (Number(item.quantity) - Number(item.receivedQty)));
        return received >= Number(item.quantity);
      });
      const nextStatus = fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: nextStatus }
      });
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/return', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = z.object({
      locationId: z.coerce.number().int().positive().optional(),
      items: z.array(z.object({
        purchaseItemId: z.number(),
        quantity: z.number().positive()
      })).min(1)
    }).parse(req.body);

    const companyId = (req as any).user.companyId;
    const purchase = await prisma.purchase.findFirst({
      where: { id: Number(id), companyId },
      include: { items: true }
    });

    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    if (purchase.status === 'PENDING') return res.status(400).json({ error: 'Purchase has not been received yet' });
    if (purchase.status === 'RETURNED') return res.status(400).json({ error: 'Purchase already fully returned' });

    const itemsById = new Map(purchase.items.map(item => [item.id, item]));
    const returnLines: { item: (typeof purchase.items)[number]; quantity: number }[] = [];
    for (const requested of parsed.items) {
      const item = itemsById.get(requested.purchaseItemId);
      if (!item) return res.status(404).json({ error: `Article introuvable: ${requested.purchaseItemId}` });
      const returnable = Number(item.receivedQty) - Number(item.returnedQty);
      if (requested.quantity > returnable) return res.status(400).json({ error: `Quantite superieure a la quantite retournable pour l'article ${item.id}` });
      returnLines.push({ item, quantity: requested.quantity });
    }

    let warehouse = await prisma.warehouse.findFirst({
      where: parsed.locationId ? { companyId, locationId: parsed.locationId } : { companyId }
    });

    if (!warehouse) return res.status(400).json({ error: 'Aucun magasin disponible pour ce retour' });

    const supplierBalanceDelta = returnLines.reduce((sum, { item, quantity }) => sum + quantity * Number(item.unitCost), 0);

    await prisma.$transaction(async (tx) => {
      for (const { item, quantity } of returnLines) {
        await tx.purchaseItem.update({
          where: { id: item.id },
          data: { returnedQty: { increment: quantity } }
        });

        const existingStock = await tx.productStock.findFirst({
          where: { productId: item.productId, warehouseId: warehouse!.id, variationId: null }
        });
        if (existingStock) {
          await tx.productStock.update({ where: { id: existingStock.id }, data: { quantity: { decrement: quantity } } });
        } else {
          await tx.productStock.create({ data: { productId: item.productId, warehouseId: warehouse!.id, quantity: -quantity } });
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: warehouse!.id,
            type: 'OUT',
            quantity,
            reference: purchase.reference,
            notes: 'Retour fournisseur'
          }
        });
      }

      if (purchase.supplierId && supplierBalanceDelta > 0) {
        await tx.contact.update({
          where: { id: purchase.supplierId },
          data: { balance: { decrement: supplierBalanceDelta } }
        });
      }

      const returnRequestByItemId = new Map(returnLines.map(({ item, quantity }) => [item.id, quantity]));
      const fullyReturned = purchase.items.every(item => {
        const returned = Number(item.returnedQty) + (returnRequestByItemId.get(item.id) ?? 0);
        return returned >= Number(item.receivedQty);
      });

      if (fullyReturned) {
        await tx.purchase.update({
          where: { id: purchase.id },
          data: { status: 'RETURNED' }
        });
      }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
