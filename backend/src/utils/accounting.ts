import { Prisma } from '../generated/client/index.js';

// Track D auto-posting (2026-08-12). Resolves the Account a money-moving event
// should post against: one per Location (lazily created, same pattern as the
// "Magasin principal" default warehouse), falling back to a single company-wide
// account (locationId: null) when the event has no location - deliberately NOT
// "the company's first location", since that non-deterministic fallback is
// tolerable for stock (existing warehouse pattern) but not for a ledger, where
// the same untargeted event should always land in the same account over time.
export const getOrCreateCashAccount = async (
  tx: Prisma.TransactionClient,
  companyId: number,
  locationId: number | null | undefined
) => {
  const name = locationId
    ? `Caisse - ${(await tx.location.findUnique({ where: { id: locationId } }))?.name || locationId}`
    : 'Caisse';

  // Match on locationId AND name, not locationId alone: accounts created
  // manually via accounting.routes.ts never set locationId either, so
  // {companyId, locationId: null} alone would also match any unrelated
  // manually-created account and silently post cash movements into it.
  // Matching the reserved 'Caisse' name keeps this bucket specific to
  // auto-posting. (For a real location, only this helper ever sets
  // locationId, so {companyId, locationId} alone is safe there.)
  const existing = locationId
    ? await tx.account.findFirst({ where: { companyId, locationId } })
    : await tx.account.findFirst({ where: { companyId, locationId: null, name } });
  if (existing) return existing;

  try {
    return await tx.account.create({ data: { companyId, locationId: locationId ?? null, name } });
  } catch (err) {
    // @@unique([companyId, name]) collision: a manually-created account already
    // has this exact name (e.g. someone made their own "Caisse" via
    // accounting.routes.ts before any auto-posting happened). Reuse it rather
    // than 500ing - findFirst-then-create can't be made atomic against a
    // uniqueness collision it didn't check for, so this catch is the recovery.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const byName = await tx.account.findFirst({ where: { companyId, name } });
      if (byName) return byName;
    }
    throw err;
  }
};

// Simplified convention shared with accounting.routes.ts: debit increases
// currentBalance, credit decreases it - correct for asset-style accounts
// (cash/bank), which is all auto-posting targets in this pass.
export const postCashTransaction = async (
  tx: Prisma.TransactionClient,
  account: { id: number },
  type: 'DEBIT' | 'CREDIT',
  amount: number,
  reference: string,
  note?: string
) => {
  if (amount <= 0) return;
  const delta = type === 'DEBIT' ? amount : -amount;
  await tx.accountTransaction.create({
    data: { accountId: account.id, type, amount, reference, note },
  });
  await tx.account.update({ where: { id: account.id }, data: { currentBalance: { increment: delta } } });
};
