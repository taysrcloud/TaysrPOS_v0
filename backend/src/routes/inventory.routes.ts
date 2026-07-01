import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/adjustment', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const parsed = z.object({
      locationId: z.coerce.number().int().positive().optional(),
      adjustments: z.array(z.object({
        productId: z.number(),
        quantity: z.number(),
        reason: z.string().optional()
      }))
    }).parse(req.body);

    const company = await prisma.company.findFirst();
    if (!company) return res.status(400).json({ error: 'No company found' });

    let warehouse = await prisma.warehouse.findFirst({
      where: parsed.locationId ? { companyId: company.id, locationId: parsed.locationId } : { companyId: company.id }
    });

    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: { companyId: company.id, name: 'Magasin principal', isMain: true }
      });
    }

    // Process adjustments in a transaction
    await prisma.$transaction(async (tx) => {
      for (const adj of parsed.adjustments) {
        // Find or create product stock
        let stock = await tx.productStock.findUnique({
          where: { productId_warehouseId: { productId: adj.productId, warehouseId: warehouse!.id } } as any
        });

        if (!stock) {
          stock = await tx.productStock.create({
            data: { productId: adj.productId, warehouseId: warehouse!.id, quantity: 0 }
          });
        }

        // Adjust stock
        const diff = adj.quantity - Number(stock.quantity);
        
        await tx.productStock.update({
          where: { id: stock.id },
          data: { quantity: adj.quantity }
        });

        if (diff !== 0) {
          await tx.stockMovement.create({
            data: {
              productId: adj.productId,
              warehouseId: warehouse!.id,
              type: diff > 0 ? 'IN' : 'OUT',
              quantity: Math.abs(diff),
              reference: adj.reason || 'AJUSTEMENT',
            }
          });
        }
      }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/warehouses', requireAuth, async (req, res, next) => {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return res.status(400).json({ error: 'No company found' });
    const warehouses = await prisma.warehouse.findMany({
      where: { companyId: company.id },
      include: { stocks: { include: { product: true } } }
    });
    res.json({ warehouses });
  } catch (err) {
    next(err);
  }
});

router.get('/movements', requireAuth, async (req, res, next) => {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return res.status(400).json({ error: 'No company found' });
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const movements = await prisma.stockMovement.findMany({
      where: {
        warehouse: {
          companyId: company.id,
          ...(locationId ? { locationId } : {}),
        }
      },
      include: { product: true, warehouse: true },
      orderBy: { createdAt: 'desc' },
      take: 150
    });

    const mapped = movements.map((movement) => ({
      id: movement.id,
      productId: movement.productId,
      productName: movement.product?.name || 'Produit',
      sku: movement.product?.sku || '',
      warehouseName: movement.warehouse?.name || 'Depot',
      date: movement.createdAt,
      type: movement.type,
      quantity: Number(movement.quantity || 0),
      reference: movement.reference || '',
      note: movement.notes || '',
      variationLabel: movement.notes?.startsWith('Vente POS - ') ? movement.notes.replace('Vente POS - ', '') : movement.notes?.startsWith('Variation ') ? movement.notes : '',
    }));

    res.json({ movements: mapped });
  } catch (err) {
    next(err);
  }
});

router.post('/transfer', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const parsed = z.object({
      sourceWarehouseId: z.number().int().positive(),
      destinationWarehouseId: z.number().int().positive(),
      productId: z.number().int().positive(),
      quantity: z.number().positive(),
      notes: z.string().optional()
    }).parse(req.body);

    if (parsed.sourceWarehouseId === parsed.destinationWarehouseId) {
      return res.status(400).json({ error: 'Source and destination warehouses must be different' });
    }

    await prisma.$transaction(async (tx) => {
      // Check and deduct from source
      const sourceStock = await tx.productStock.findUnique({
        where: { productId_warehouseId: { productId: parsed.productId, warehouseId: parsed.sourceWarehouseId } } as any
      });
      if (!sourceStock || Number(sourceStock.quantity) < parsed.quantity) {
        throw new Error('Insufficient stock in source warehouse');
      }
      await tx.productStock.update({
        where: { id: sourceStock.id },
        data: { quantity: { decrement: parsed.quantity } }
      });
      await tx.stockMovement.create({
        data: { productId: parsed.productId, warehouseId: parsed.sourceWarehouseId, type: 'TRANSFER', quantity: -parsed.quantity, reference: parsed.notes || 'Transfer Out' }
      });

      // Add to destination
      await tx.productStock.upsert({
        where: { productId_warehouseId: { productId: parsed.productId, warehouseId: parsed.destinationWarehouseId } } as any,
        update: { quantity: { increment: parsed.quantity } },
        create: { productId: parsed.productId, warehouseId: parsed.destinationWarehouseId, quantity: parsed.quantity }
      });
      await tx.stockMovement.create({
        data: { productId: parsed.productId, warehouseId: parsed.destinationWarehouseId, type: 'TRANSFER', quantity: parsed.quantity, reference: parsed.notes || 'Transfer In' }
      });
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Server error' });
  }
});

export default router;
