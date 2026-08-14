import type { PrismaClient } from '../generated/client/index.js';

const asNumber = (value: unknown) => value && typeof value === 'object' && 'toNumber' in value
  ? (value as { toNumber: () => number }).toNumber()
  : Number(value || 0);

export async function resolveActiveDiscounts(
  prisma: PrismaClient,
  companyId: number,
  productId: number,
  categoryId: number | null,
  brandId: number | null,
  basePrice: number
): Promise<number> {
  const now = new Date();
  const activeDiscounts = await prisma.discount.findMany({
    where: {
      companyId,
      isActive: true,
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
  });

  let bestDiscountPrice = basePrice;
  for (const d of activeDiscounts) {
    let applies = false;
    if (d.appliesTo === 'ALL') applies = true;
    else if (d.appliesTo === 'BRAND' && d.brandId === brandId) applies = true;
    else if (d.appliesTo === 'CATEGORY' && d.categoryId === categoryId) applies = true;
    else if (d.appliesTo === 'PRODUCT') {
      const dProdIds = Array.isArray(d.productIds) ? (d.productIds as number[]) : (d.productIds ? JSON.parse(d.productIds as string) : []);
      if (dProdIds.includes(productId)) applies = true;
    }
    
    if (applies) {
      let currentDiscountPrice = basePrice;
      if (d.discountType === 'PERCENTAGE') {
        currentDiscountPrice = basePrice * (1 - asNumber(d.amount) / 100);
      } else if (d.discountType === 'FIXED') {
        currentDiscountPrice = Math.max(0, basePrice - asNumber(d.amount));
      }
      if (currentDiscountPrice < bestDiscountPrice) {
        bestDiscountPrice = currentDiscountPrice;
      }
    }
  }
  return bestDiscountPrice;
}

export async function resolveCustomerGroupPrices(
  prisma: PrismaClient,
  companyId: number,
  customerId: number | null | undefined,
  productIds?: number[],
): Promise<Map<number, number>> {
  let groupOverrides = new Map<number, number>();
  
  if (customerId) {
    const contact = await prisma.contact.findFirst({
      where: { id: customerId, companyId },
      select: { customerGroupId: true },
    });
    if (contact?.customerGroupId) {
      const group = await prisma.customerGroup.findFirst({
        where: { id: contact.customerGroupId, companyId },
        select: { priceGroupId: true },
      });
      if (group?.priceGroupId) {
        const overrides = await prisma.productGroupPrice.findMany({
          where: { priceGroupId: group.priceGroupId, ...(productIds?.length ? { productId: { in: productIds } } : {}) },
          select: { productId: true, price: true },
        });
        for (const o of overrides) {
          groupOverrides.set(o.productId, asNumber(o.price));
        }
      }
    }
  }

  const now = new Date();
  const activeDiscounts = await prisma.discount.findMany({
    where: {
      companyId,
      isActive: true,
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
  });

  if (groupOverrides.size === 0 && activeDiscounts.length === 0) {
    return new Map();
  }

  const products = await prisma.product.findMany({
    where: {
      companyId,
      ...(productIds?.length ? { id: { in: productIds } } : {})
    },
    select: { id: true, salePrice: true, categoryId: true, brandId: true }
  });

  const bestPrices = new Map<number, number>();

  for (const p of products) {
    const basePrice = asNumber(p.salePrice);
    
    let finalPrice = basePrice;
    if (groupOverrides.has(p.id)) {
      finalPrice = groupOverrides.get(p.id)!;
    }

    let bestDiscountPrice = basePrice;
    for (const d of activeDiscounts) {
      let applies = false;
      if (d.appliesTo === 'ALL') applies = true;
      else if (d.appliesTo === 'BRAND' && d.brandId === p.brandId) applies = true;
      else if (d.appliesTo === 'CATEGORY' && d.categoryId === p.categoryId) applies = true;
      else if (d.appliesTo === 'PRODUCT') {
        const dProdIds = Array.isArray(d.productIds) ? (d.productIds as number[]) : (d.productIds ? JSON.parse(d.productIds as string) : []);
        if (dProdIds.includes(p.id)) applies = true;
      }
      
      if (applies) {
        let currentDiscountPrice = basePrice;
        if (d.discountType === 'PERCENTAGE') {
          currentDiscountPrice = basePrice * (1 - asNumber(d.amount) / 100);
        } else if (d.discountType === 'FIXED') {
          currentDiscountPrice = Math.max(0, basePrice - asNumber(d.amount));
        }
        if (currentDiscountPrice < bestDiscountPrice) {
          bestDiscountPrice = currentDiscountPrice;
        }
      }
    }

    const lowestPrice = Math.min(finalPrice, bestDiscountPrice);
    if (lowestPrice < basePrice) {
      bestPrices.set(p.id, lowestPrice);
    }
  }

  return bestPrices;
}
