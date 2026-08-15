import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { getTenantPrisma } from '../utils/prisma.js';

// Get all purchase orders
export const getPurchases = async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getTenantPrisma();
    const purchases = await prisma.purchase.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        supplier: true,
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Create a new purchase order and receive stock
export const createPurchase = async (req: AuthRequest, res: Response) => {
  try {
    const { supplierId, reference, items, warehouseId } = req.body;
    const prisma = getTenantPrisma();

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    const total = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.cost)), 0);

    const purchase = await prisma.$transaction(async (tx: any) => {
      // Create PO
      const po = await tx.purchase.create({
        data: {
          companyId: req.user!.companyId,
          supplierId,
          reference: reference || `PO-${Date.now()}`,
          status: 'RECEIVED',
          total,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              variationId: item.variationId || null,
              quantity: item.quantity,
              cost: item.cost
            }))
          }
        },
        include: { items: true, supplier: true }
      });

      // Receive Stock & Log Movements
      for (const item of items) {
        let stock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId_variationId: {
              productId: item.productId,
              warehouseId,
              variationId: item.variationId || null
            }
          }
        });

        if (stock) {
          await tx.productStock.update({
            where: { id: stock.id },
            data: { quantity: { increment: item.quantity } }
          });
        } else {
          await tx.productStock.create({
            data: {
              productId: item.productId,
              warehouseId,
              variationId: item.variationId || null,
              quantity: item.quantity
            }
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId,
            type: 'IN',
            quantity: item.quantity,
            notes: `Purchase Order: ${po.reference}`
          }
        });
      }

      // Update supplier balance
      await tx.contact.update({
        where: { id: supplierId },
        data: { balance: { increment: total } }
      });

      return po;
    });

    res.json(purchase);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
