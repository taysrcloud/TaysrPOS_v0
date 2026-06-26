import { Router } from 'express';
import { z } from 'zod';
import { ProductType } from '../generated/client/index.js';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const demoImage = (label: string, bg = '#dbeafe') => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs><rect width="320" height="220" rx="28" fill="url(#g)"/><rect x="94" y="38" width="132" height="148" rx="24" fill="#fff" stroke="#cbd5e1"/><circle cx="160" cy="88" r="28" fill="${bg}"/><rect x="118" y="130" width="84" height="12" rx="6" fill="#cbd5e1"/><rect x="130" y="150" width="60" height="10" rx="5" fill="#e2e8f0"/><text x="160" y="206" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="#0f172a">${label}</text></svg>`)}`;

const demoProducts = [
  { id: 1, name: 'Bouteille eau 50cl', sku: 'EAU-050', barcode: '611000001', type: 'RETAIL', category: 'Boissons', brand: 'Sidi Ali', imageUrl: demoImage('Eau 50cl', '#bae6fd'), salePrice: 6, purchasePrice: 3.2, tvaRate: 20, trackStock: true, lowStockAlert: 12, stock: 36, isKitchenItem: false, isActive: true, createdAt: new Date() },
  { id: 2, name: 'Riz 5kg', sku: 'RIZ-005', barcode: '611000002', type: 'RETAIL', category: 'Epicerie', brand: null, imageUrl: demoImage('Riz 5kg', '#fde68a'), salePrice: 58, purchasePrice: 46, tvaRate: 20, trackStock: true, lowStockAlert: 8, stock: 21, isKitchenItem: false, isActive: true, createdAt: new Date() },
  { id: 3, name: 'Recharge mobile', sku: 'SRV-RECHARGE', barcode: null, type: 'SERVICE', category: 'Services', brand: null, imageUrl: demoImage('Service', '#ddd6fe'), salePrice: 20, purchasePrice: 0, tvaRate: 0, trackStock: false, lowStockAlert: 0, stock: 0, isKitchenItem: false, isActive: true, createdAt: new Date() },
];

const demoResponse = () => ({
  products: demoProducts,
  stats: {
    total: demoProducts.length,
    lowStock: demoProducts.filter(product => product.trackStock && product.stock <= product.lowStockAlert).length,
    restaurantItems: demoProducts.filter(product => product.type === 'MENU_ITEM').length,
    retailItems: demoProducts.filter(product => product.type === 'RETAIL').length,
  },
  source: 'demo',
});

const productSchema = z.object({
  name: z.string().trim().min(2),
  salePrice: z.coerce.number().min(0),
  categoryName: z.string().trim().min(1).default('General'),
  barcode: z.string().trim().optional().nullable(),
  sku: z.string().trim().optional().nullable(),
  initialStock: z.coerce.number().min(0).default(0),
  type: z.enum(['RETAIL', 'MENU_ITEM', 'INGREDIENT', 'SERVICE', 'BUNDLE']).default('RETAIL'),
  purchasePrice: z.coerce.number().min(0).default(0),
  brandName: z.string().trim().optional().nullable(),
  unitName: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  tvaRate: z.coerce.number().min(0).max(100).default(20),
  trackStock: z.coerce.boolean().default(true),
  lowStockAlert: z.coerce.number().min(0).default(0),
  isKitchenItem: z.coerce.boolean().default(false),
  isVariable: z.coerce.boolean().default(false),
  variationOptions: z.array(z.string()).optional().nullable(),
  variations: z.array(z.object({
    name: z.string(),
    attributes: z.record(z.string()).optional().nullable(),
    sku: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    salePrice: z.coerce.number().optional().nullable(),
    purchasePrice: z.coerce.number().optional().nullable(),
    stock: z.coerce.number().default(0)
  })).optional().nullable(),
});

const asNumber = (value: unknown) => value && typeof value === 'object' && 'toNumber' in value
  ? (value as { toNumber: () => number }).toNumber()
  : Number(value || 0);

const normalizeProduct = (product: any, locationId?: number) => ({
  id: product.id,
  name: product.name,
  sku: product.sku,
  barcode: product.barcode,
  type: product.type,
  salePrice: asNumber(product.salePrice),
  purchasePrice: asNumber(product.purchasePrice),
  tvaRate: asNumber(product.tvaRate),
  trackStock: product.trackStock,
  lowStockAlert: asNumber(product.lowStockAlert),
  stock: product.stocks?.reduce((sum: number, stock: any) => {
    if (stock.variationId) return sum; // don't sum variation stocks into base stock if not needed, or do we?
    if (locationId && stock.warehouse?.locationId !== locationId) return sum;
    return sum + asNumber(stock.quantity);
  }, 0) || 0,
  category: product.category?.name || 'General',
  brand: product.brand?.name || null,
  imageUrl: product.imageUrl || null,
  unit: product.unit?.shortName || 'pcs',
  isKitchenItem: product.isKitchenItem,
  isVariable: product.isVariable,
  variationOptions: product.variationOptions,
  variations: product.variations?.map((v: any) => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    barcode: v.barcode,
    salePrice: v.salePrice ? asNumber(v.salePrice) : null,
    purchasePrice: v.purchasePrice ? asNumber(v.purchasePrice) : null,
    attributes: v.attributes,
    isActive: v.isActive,
    stock: v.stocks?.reduce((sum: number, stock: any) => {
      if (locationId && stock.warehouse?.locationId !== locationId) return sum;
      return sum + asNumber(stock.quantity);
    }, 0) || 0,
  })),
  isActive: product.isActive,
  createdAt: product.createdAt,
});

const slugSku = (name: string) => name
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 18)
  .toUpperCase() || 'PRD';


router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const companyId = req.user.companyId;
    const company = { id: companyId };
    const search = String(req.query.search || '').trim();
    const type = String(req.query.type || 'ALL');
    const where: any = { companyId: company.id };
    if (type !== 'ALL') where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;

    const products = await prisma.product.findMany({
      where,
      include: { 
        category: true, 
        brand: true, 
        unit: true, 
        stocks: { include: { warehouse: true } },
        variations: { include: { stocks: { include: { warehouse: true } } } }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });

    const normalized = products.map(p => normalizeProduct(p, locationId));
    res.json({
      products: normalized,
      stats: {
        total: normalized.length,
        lowStock: normalized.filter(product => product.trackStock && product.stock <= product.lowStockAlert).length,
        restaurantItems: normalized.filter(product => product.type === 'MENU_ITEM').length,
        retailItems: normalized.filter(product => product.type === 'RETAIL').length,
      },
    });
  } catch (error) {
    console.error('Products list error:', error);
    res.status(200).json({ ...demoResponse(), message: 'Base de donnees indisponible: produits demo affiches' });
  }
});

router.post('/', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: any, res: any) => {
  try {
    const companyId = req.user.companyId;
    const company = { id: companyId };
    let defaultUnit = await prisma.unit.findFirst({ where: { companyId } });
    if (!defaultUnit) defaultUnit = await prisma.unit.create({ data: { companyId, name: 'Piece', shortName: 'pcs' } });
    let warehouse = await prisma.warehouse.findFirst({ where: { companyId, isMain: true } });
    if (!warehouse) warehouse = await prisma.warehouse.create({ data: { companyId, name: 'Magasin principal', isMain: true } });
    
    const data = productSchema.parse(req.body);
    const category = await prisma.category.upsert({
      where: { companyId_name: { companyId: company.id, name: data.categoryName } },
      update: {},
      create: { companyId: company.id, name: data.categoryName },
    });
    const brand = data.brandName
      ? await prisma.brand.upsert({
          where: { companyId_name: { companyId: company.id, name: data.brandName } },
          update: {},
          create: { companyId: company.id, name: data.brandName },
        })
      : null;
    const unitShortName = data.unitName || defaultUnit.shortName;
    const unit = await prisma.unit.upsert({
      where: { companyId_shortName: { companyId: company.id, shortName: unitShortName } },
      update: {},
      create: { companyId: company.id, name: unitShortName, shortName: unitShortName },
    });

    const sku = data.sku || data.barcode || `${slugSku(data.name)}-${Date.now().toString().slice(-5)}`;
    
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          companyId: company.id,
          categoryId: category.id,
          brandId: brand?.id,
          unitId: unit.id,
          name: data.name,
          sku,
          barcode: data.barcode || null,
          imageUrl: data.imageUrl || null,
          type: data.type as ProductType,
          salePrice: data.salePrice,
          purchasePrice: data.purchasePrice,
          tvaRate: data.tvaRate,
          trackStock: data.trackStock,
          lowStockAlert: data.lowStockAlert,
          isKitchenItem: data.type === 'MENU_ITEM' ? data.isKitchenItem : false,
          isVariable: data.isVariable,
          variationOptions: data.variationOptions ? data.variationOptions : undefined,
        },
      });

      if (data.isVariable && data.variations && data.variations.length > 0) {
        for (let i = 0; i < data.variations.length; i++) {
          const v = data.variations[i];
          const vSku = v.sku || `${sku}-${i + 1}`;
          const variation = await tx.productVariation.create({
            data: {
              productId: created.id,
              name: v.name,
              attributes: v.attributes ? v.attributes : undefined,
              sku: vSku,
              barcode: v.barcode || null,
              salePrice: v.salePrice,
              purchasePrice: v.purchasePrice,
            }
          });

          if (data.trackStock) {
            await tx.productStock.create({
              data: { productId: created.id, warehouseId: warehouse!.id, variationId: variation.id, quantity: v.stock }
            });
            if (v.stock > 0) {
              await tx.stockMovement.create({
                data: {
                  productId: created.id,
                  warehouseId: warehouse!.id,
                  type: 'IN',
                  quantity: v.stock,
                  reference: 'CREATION-PRODUIT-VAR'
                }
              });
            }
          }
        }
      } else if (data.trackStock) {
        await tx.productStock.create({
          data: { productId: created.id, warehouseId: warehouse!.id, quantity: data.initialStock },
        });
        if (data.initialStock > 0) {
          await tx.stockMovement.create({
            data: {
              productId: created.id,
              warehouseId: warehouse!.id,
              type: 'IN',
              quantity: data.initialStock,
              reference: 'CREATION-PRODUIT',
            },
          });
        }
      }

      return tx.product.findUnique({
        where: { id: created.id },
        include: { category: true, brand: true, unit: true, stocks: { include: { warehouse: true } }, variations: { include: { stocks: { include: { warehouse: true } } } } },
      });
    });

    res.status(201).json(normalizeProduct(product));
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: 'Produit invalide', errors: error.issues });
    if (error?.code === 'P2002') return res.status(409).json({ message: 'SKU ou code-barres deja utilise' });
    console.error('Product create error:', error);
    res.status(500).json({ message: 'Erreur lors de la creation du produit' });
  }
});

export default router;
