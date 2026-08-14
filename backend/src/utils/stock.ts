import { Prisma } from '../generated/client/index.js';

export async function adjustProductStock(
  tx: Prisma.TransactionClient,
  productId: number,
  warehouseId: number,
  variationId: number | null | undefined,
  deltaQty: number
) {
  const normVariationId = variationId ?? null;
  const existingStock = await tx.productStock.findFirst({
    where: { productId, warehouseId, variationId: normVariationId },
  });

  if (existingStock) {
    return tx.productStock.update({
      where: { id: existingStock.id },
      data: { quantity: { increment: deltaQty } },
    });
  }

  try {
    return await tx.productStock.create({
      data: {
        productId,
        warehouseId,
        variationId: normVariationId,
        quantity: deltaQty,
      },
    });
  } catch (err: any) {
    // Unique constraint race condition catch (e.g. concurrent creation for new product)
    const retryStock = await tx.productStock.findFirst({
      where: { productId, warehouseId, variationId: normVariationId },
    });
    if (retryStock) {
      return tx.productStock.update({
        where: { id: retryStock.id },
        data: { quantity: { increment: deltaQty } },
      });
    }
    throw err;
  }
}
