import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { getTenantPrisma } from '../utils/prisma.js';

// Get all warehouses for the company
export const getWarehouses = async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getTenantPrisma();
    const warehouses = await prisma.warehouse.findMany({
      where: { companyId: req.user!.companyId, isActive: true },
      include: {
        stocks: true
      }
    });
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get recent stock movements
export const getStockMovements = async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getTenantPrisma();
    const movements = await prisma.stockMovement.findMany({
      where: { warehouse: { companyId: req.user!.companyId } },
      include: {
        product: true,
        warehouse: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Adjust stock manually
export const adjustStock = async (req: AuthRequest, res: Response) => {
  try {
    const { productId, variationId, warehouseId, quantity, notes } = req.body;
    const prisma = getTenantPrisma();

    // Find existing stock or create 0
    let stock = await prisma.productStock.findUnique({
      where: {
        productId_warehouseId_variationId: {
          productId,
          warehouseId,
          variationId: variationId || null
        }
      }
    });

    if (!stock) {
      stock = await prisma.productStock.create({
        data: {
          productId,
          warehouseId,
          variationId: variationId || null,
          quantity: 0
        }
      });
    }

    const diff = Number(quantity) - Number(stock.quantity);
    if (diff === 0) return res.json(stock);

    const newStock = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.productStock.update({
        where: { id: stock!.id },
        data: { quantity: quantity }
      });

      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId,
          type: 'ADJUSTMENT',
          quantity: diff,
          notes: notes || 'Manual adjustment'
        }
      });
      return updated;
    });

    res.json(newStock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Transfer stock between warehouses
export const transferStock = async (req: AuthRequest, res: Response) => {
  try {
    const { sourceWarehouseId, destinationWarehouseId, productId, variationId, quantity, notes } = req.body;
    const prisma = getTenantPrisma();

    if (sourceWarehouseId === destinationWarehouseId) {
      return res.status(400).json({ error: 'Cannot transfer to the same warehouse' });
    }

    const qty = Number(quantity);
    if (qty <= 0) return res.status(400).json({ error: 'Quantity must be positive' });

    const result = await prisma.$transaction(async (tx: any) => {
      // Deduct from source
      let sourceStock = await tx.productStock.findUnique({
        where: { productId_warehouseId_variationId: { productId, warehouseId: sourceWarehouseId, variationId: variationId || null } }
      });

      if (!sourceStock || Number(sourceStock.quantity) < qty) {
        throw new Error('Insufficient stock in source warehouse');
      }

      await tx.productStock.update({
        where: { id: sourceStock.id },
        data: { quantity: { decrement: qty } }
      });

      await tx.stockMovement.create({
        data: { productId, warehouseId: sourceWarehouseId, type: 'TRANSFER', quantity: -qty, notes: `Transfer to WH ${destinationWarehouseId}: ${notes || ''}` }
      });

      // Add to destination
      let destStock = await tx.productStock.findUnique({
        where: { productId_warehouseId_variationId: { productId, warehouseId: destinationWarehouseId, variationId: variationId || null } }
      });

      if (destStock) {
        await tx.productStock.update({
          where: { id: destStock.id },
          data: { quantity: { increment: qty } }
        });
      } else {
        await tx.productStock.create({
          data: { productId, warehouseId: destinationWarehouseId, variationId: variationId || null, quantity: qty }
        });
      }

      await tx.stockMovement.create({
        data: { productId, warehouseId: destinationWarehouseId, type: 'TRANSFER', quantity: qty, notes: `Transfer from WH ${sourceWarehouseId}: ${notes || ''}` }
      });

      return { success: true };
    });

    res.json(result);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ error: error.message || 'Server error' });
  }
};
