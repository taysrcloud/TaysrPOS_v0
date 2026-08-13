import type { PrismaClient } from '../generated/client/index.js';

const asNumber = (value: unknown) => value && typeof value === 'object' && 'toNumber' in value
  ? (value as { toNumber: () => number }).toNumber()
  : Number(value || 0);

// Track C: resolve a customer's selling-price-group overrides into a
// productId -> price map. Both CustomerGroup.priceGroupId and a customer's
// own group assignment are optional/nullable - a grouped customer with no
// price group, or a customer with no group at all, are both valid states
// that simply resolve to an empty map (callers fall back to the product's
// own salePrice, exactly as before this existed). Sparse by design:
// ProductGroupPrice only has rows for products with an explicit override.
export async function resolveCustomerGroupPrices(
  prisma: PrismaClient,
  companyId: number,
  customerId: number | null | undefined,
  productIds?: number[],
): Promise<Map<number, number>> {
  if (!customerId) return new Map();
  const contact = await prisma.contact.findFirst({
    where: { id: customerId, companyId },
    select: { customerGroupId: true },
  });
  if (!contact?.customerGroupId) return new Map();
  const group = await prisma.customerGroup.findFirst({
    where: { id: contact.customerGroupId, companyId },
    select: { priceGroupId: true },
  });
  if (!group?.priceGroupId) return new Map();
  const overrides = await prisma.productGroupPrice.findMany({
    where: { priceGroupId: group.priceGroupId, ...(productIds?.length ? { productId: { in: productIds } } : {}) },
    select: { productId: true, price: true },
  });
  return new Map(overrides.map(o => [o.productId, asNumber(o.price)]));
}
