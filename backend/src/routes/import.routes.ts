import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const productsImportSchema = z.object({
  products: z.array(
    z.object({
      name: z.string().trim().min(1),
      sku: z.string().trim().min(1),
      price: z.coerce.number().min(0),
      cost: z.coerce.number().min(0).default(0),
      barcode: z.string().trim().optional().nullable(),
      categoryName: z.string().trim().min(1).default('General'),
      brandName: z.string().trim().optional().nullable(),
    })
  ).min(1).max(1000),
});

const stockImportSchema = z.object({
  stockItems: z.array(
    z.object({
      sku: z.string().trim().min(1),
      quantity: z.coerce.number().min(0),
      locationId: z.coerce.number().int().optional(),
    })
  ).min(1).max(1000),
});

const slugSku = (name: string) => name
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 18)
  .toUpperCase() || 'PRD';

router.post('/products', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: any, res: any) => {
  try {
    const companyId = req.user.companyId;
    const { products } = productsImportSchema.parse(req.body);

    // Prepare default unit
    let defaultUnit = await prisma.unit.findFirst({ where: { companyId } });
    if (!defaultUnit) {
      defaultUnit = await prisma.unit.create({ data: { companyId, name: 'Piece', shortName: 'pcs' } });
    }

    const results = await prisma.$transaction(async (tx) => {
      let createdCount = 0;
      let updatedCount = 0;

      for (const item of products) {
        // Upsert category
        const category = await tx.category.upsert({
          where: { companyId_name: { companyId, name: item.categoryName || 'General' } },
          update: {},
          create: { companyId, name: item.categoryName || 'General' },
        });

        // Upsert brand if present
        let brandId = null;
        if (item.brandName) {
          const brand = await tx.brand.upsert({
            where: { companyId_name: { companyId, name: item.brandName } },
            update: {},
            create: { companyId, name: item.brandName },
          });
          brandId = brand.id;
        }

        const sku = item.sku || item.barcode || `${slugSku(item.name)}-${Date.now().toString().slice(-5)}`;

        const existing = await tx.product.findUnique({
          where: { companyId_sku: { companyId, sku } }
        });

        if (existing) {
          await tx.product.update({
            where: { id: existing.id },
            data: {
              name: item.name,
              salePrice: item.price,
              purchasePrice: item.cost,
              barcode: item.barcode || existing.barcode,
              categoryId: category.id,
              brandId,
            }
          });
          updatedCount++;
        } else {
          await tx.product.create({
            data: {
              companyId,
              name: item.name,
              sku,
              salePrice: item.price,
              purchasePrice: item.cost,
              barcode: item.barcode || null,
              categoryId: category.id,
              brandId,
              unitId: defaultUnit.id,
              type: 'RETAIL',
              trackStock: true,
            }
          });
          createdCount++;
        }
      }
      return { createdCount, updatedCount };
    });

    res.status(200).json({ message: 'Products imported successfully', ...results });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid products data', errors: error.issues });
    }
    console.error('Products import error:', error);
    res.status(500).json({ message: 'Error importing products' });
  }
});

router.post('/stock', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: any, res: any) => {
  try {
    const companyId = req.user.companyId;
    const { stockItems } = stockImportSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      let updatedCount = 0;
      let notFoundCount = 0;

      for (const item of stockItems) {
        const product = await tx.product.findUnique({
          where: { companyId_sku: { companyId, sku: item.sku } }
        });

        if (!product) {
          notFoundCount++;
          continue;
        }

        // Find warehouse for location or main warehouse
        let warehouseQuery: any = { companyId };
        if (item.locationId) {
          warehouseQuery.locationId = item.locationId;
        } else {
          warehouseQuery.isMain = true;
        }
        let warehouse = await tx.warehouse.findFirst({ where: warehouseQuery });
        
        if (!warehouse) {
           warehouse = await tx.warehouse.findFirst({ where: { companyId, isMain: true } });
        }
        if (!warehouse) {
           warehouse = await tx.warehouse.create({ data: { companyId, name: 'Magasin principal', isMain: true } });
        }

        const existingStock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId_variationId: {
              productId: product.id,
              warehouseId: warehouse.id,
              variationId: 0 // Will map to null later if prisma handles it, or just use findFirst
            }
          }
        });
        
        // Let's use findFirst since variationId is optional
        const currentStock = await tx.productStock.findFirst({
          where: { productId: product.id, warehouseId: warehouse.id, variationId: null }
        });

        const prevQuantity = currentStock ? Number(currentStock.quantity) : 0;
        const diff = item.quantity - prevQuantity;

        if (currentStock) {
          await tx.productStock.update({
            where: { id: currentStock.id },
            data: { quantity: item.quantity }
          });
        } else {
          await tx.productStock.create({
            data: {
              productId: product.id,
              warehouseId: warehouse.id,
              quantity: item.quantity
            }
          });
        }

        if (diff !== 0) {
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              warehouseId: warehouse.id,
              type: diff > 0 ? 'IN' : 'OUT',
              quantity: Math.abs(diff),
              reference: 'IMPORT-CSV'
            }
          });
        }
        updatedCount++;
      }
      return { updatedCount, notFoundCount };
    });

    res.status(200).json({ message: 'Stock imported successfully', ...result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid stock data', errors: error.issues });
    }
    console.error('Stock import error:', error);
    res.status(500).json({ message: 'Error importing stock' });
  }
});

export default router;
