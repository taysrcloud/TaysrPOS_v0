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
          where: { productId_warehouseId: { productId: adj.productId, warehouseId: warehouse!.id } }
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

export default router;
