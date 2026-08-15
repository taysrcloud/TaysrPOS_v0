import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

// Track D (financial/accounting): Account/AccountType/AccountTransaction ledger.
// Manual posting only in this pass - auto-posting from Sale/Purchase/Payment/
// Expense/CashMovement would mean editing those routes' existing money-moving
// logic with no database to verify against (see schema.prisma comment).
const router = Router();

const asNumber = (value: unknown) => value && typeof value === 'object' && 'toNumber' in value
  ? (value as { toNumber: () => number }).toNumber()
  : Number(value || 0);

router.get('/types', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const types = await prisma.accountType.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
    res.json({ types });
  } catch (err) {
    next(err);
  }
});

router.get('/trial-balance', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const accounts = await prisma.account.findMany({
      where: { companyId },
      include: { accountType: true, transactions: true },
      orderBy: { name: 'asc' },
    });

    const report = accounts.map(account => {
      const opening = asNumber(account.openingBalance);
      let totalDebit = 0;
      let totalCredit = 0;

      for (const t of account.transactions) {
        const amt = asNumber(t.amount);
        if (t.type === 'DEBIT') totalDebit += amt;
        else if (t.type === 'CREDIT') totalCredit += amt;
      }

      const netBalance = opening + totalDebit - totalCredit;
      return {
        id: account.id,
        name: account.name,
        accountNumber: account.accountNumber,
        accountType: account.accountType?.name || 'Général',
        openingBalance: opening,
        totalDebit,
        totalCredit,
        netBalance,
      };
    });

    const summary = report.reduce(
      (acc, r) => {
        acc.totalDebit += r.totalDebit;
        acc.totalCredit += r.totalCredit;
        acc.totalBalance += r.netBalance;
        return acc;
      },
      { totalDebit: 0, totalCredit: 0, totalBalance: 0 }
    );

    res.json({ trialBalance: report, summary });
  } catch (err) { next(err); }
});

router.post('/types', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const parsed = z.object({ name: z.string().trim().min(2) }).parse(req.body);
    const type = await prisma.accountType.create({ data: { companyId, name: parsed.name } });
    res.status(201).json({ success: true, type });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Type de compte invalide', errors: err.issues });
    next(err);
  }
});

router.get('/accounts', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const accounts = await prisma.account.findMany({
      where: { companyId },
      include: { accountType: true },
      orderBy: { name: 'asc' },
    });
    res.json({
      accounts: accounts.map(a => ({
        ...a,
        openingBalance: asNumber(a.openingBalance),
        currentBalance: asNumber(a.currentBalance),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/accounts', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const parsed = z.object({
      name: z.string().trim().min(2),
      accountTypeId: z.coerce.number().int().positive().optional().nullable(),
      accountNumber: z.string().optional().nullable(),
      openingBalance: z.coerce.number().default(0),
    }).parse(req.body);

    if (parsed.accountTypeId) {
      const type = await prisma.accountType.findFirst({ where: { id: parsed.accountTypeId, companyId } });
      if (!type) return res.status(400).json({ message: 'Type de compte invalide' });
    }

    const account = await prisma.account.create({
      data: {
        companyId,
        name: parsed.name,
        accountTypeId: parsed.accountTypeId || null,
        accountNumber: parsed.accountNumber || null,
        openingBalance: parsed.openingBalance,
        currentBalance: parsed.openingBalance,
      },
    });
    res.status(201).json({ success: true, account: { ...account, openingBalance: asNumber(account.openingBalance), currentBalance: asNumber(account.currentBalance) } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Compte invalide', errors: err.issues });
    next(err);
  }
});

router.get('/accounts/:id/transactions', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const accountId = Number(req.params.id);
    const account = await prisma.account.findFirst({ where: { id: accountId, companyId } });
    if (!account) return res.status(404).json({ message: 'Compte introuvable' });

    const transactions = await prisma.accountTransaction.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({
      account: { ...account, openingBalance: asNumber(account.openingBalance), currentBalance: asNumber(account.currentBalance) },
      transactions: transactions.map(t => ({ ...t, amount: asNumber(t.amount) })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/accounts/:id/transactions', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const accountId = Number(req.params.id);
    const account = await prisma.account.findFirst({ where: { id: accountId, companyId } });
    if (!account) return res.status(404).json({ message: 'Compte introuvable' });

    const parsed = z.object({
      type: z.enum(['DEBIT', 'CREDIT']),
      amount: z.coerce.number().positive(),
      reference: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
    }).parse(req.body);

    // Simplified convention (debit increases currentBalance, credit decreases it) -
    // correct for asset-style accounts (cash/bank), not for liability/equity ones.
    // Full account-type-aware posting rules are out of scope for this pass.
    const delta = parsed.type === 'DEBIT' ? parsed.amount : -parsed.amount;
    const [transaction] = await prisma.$transaction([
      prisma.accountTransaction.create({
        data: { accountId, type: parsed.type, amount: parsed.amount, reference: parsed.reference, note: parsed.note },
      }),
      prisma.account.update({ where: { id: accountId }, data: { currentBalance: { increment: delta } } }),
    ]);

    res.status(201).json({ success: true, transaction: { ...transaction, amount: asNumber(transaction.amount) } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Transaction invalide', errors: err.issues });
    next(err);
  }
});

router.get('/ledger/:accountId', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const accountId = Number(req.params.accountId);
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(0);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const account = await prisma.account.findFirst({ where: { id: accountId, companyId }, include: { accountType: true } });
    if (!account) return res.status(404).json({ message: 'Compte introuvable' });

    const allTx = await prisma.accountTransaction.findMany({
      where: { accountId },
      orderBy: { createdAt: 'asc' },
    });

    let openingBalance = asNumber(account.openingBalance);
    let currentBalance = openingBalance;
    const transactions = [];

    for (const t of allTx) {
      const amt = asNumber(t.amount);
      const isBefore = t.createdAt < startDate;
      const isInRange = t.createdAt >= startDate && t.createdAt <= endDate;

      if (t.type === 'DEBIT') {
        if (isBefore) openingBalance += amt;
        currentBalance += amt;
      } else {
        if (isBefore) openingBalance -= amt;
        currentBalance -= amt;
      }

      if (isInRange) {
        transactions.push({ ...t, amount: amt });
      }
    }

    res.json({
      account: { ...account, openingBalance: asNumber(account.openingBalance), currentBalance: asNumber(account.currentBalance) },
      openingBalance,
      currentBalance,
      transactions,
    });
  } catch (err) { next(err); }
});

router.get('/pnl', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(0);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const saleWhere: any = { companyId, createdAt: { gte: startDate, lte: endDate } };
    if (locationId) saleWhere.locationId = locationId;

    const sales = await prisma.sale.findMany({
      where: saleWhere,
      include: { items: { include: { product: true } } }
    });

    let totalSales = 0;
    let costOfGoodsSold = 0;

    for (const s of sales) {
      if (s.status === 'RETURNED' || s.status === 'DRAFT') continue;

      for (const line of s.items) {
        const activeQty = asNumber(line.quantity) - asNumber(line.returnedQty || 0);
        if (activeQty <= 0) continue;
        const lineVal = asNumber(line.unitPrice) * activeQty - asNumber(line.discount);
        const lineNet = lineVal / (1 + asNumber(line.tvaRate)/100);
        totalSales += lineNet; // PNL uses net sales usually, but totalSales could be gross. Let's use net to be accurate for PNL, or gross? Actually, standard P&L totalSales is Revenue (Net of Tax). Let's use net.
        costOfGoodsSold += asNumber(line.product?.purchasePrice || 0) * activeQty;
      }
    }

    const expenseWhere: any = { companyId, date: { gte: startDate, lte: endDate }, isActive: true };
    if (locationId) expenseWhere.locationId = locationId;

    const expensesList = await prisma.expense.findMany({ where: expenseWhere });
    let totalExpenses = expensesList.reduce((sum, e) => sum + asNumber(e.amount), 0);

    const grossProfit = totalSales - costOfGoodsSold;
    const netProfit = grossProfit - totalExpenses;

    res.json({
      totalSales,
      costOfGoodsSold,
      grossProfit,
      totalExpenses,
      netProfit,
    });
  } catch (err) { next(err); }
});

router.get('/tax-report', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(0);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const sales = await prisma.sale.findMany({
      where: { companyId, createdAt: { gte: startDate, lte: endDate }, status: { notIn: ['DRAFT', 'RETURNED'] } },
      include: { items: true }
    });

    let tvaCollected = 0;
    for (const s of sales) {
      for (const line of s.items) {
        const activeQty = asNumber(line.quantity) - asNumber(line.returnedQty || 0);
        if (activeQty <= 0) continue;
        const lineVal = asNumber(line.unitPrice) * activeQty - asNumber(line.discount);
        const lineNet = lineVal / (1 + asNumber(line.tvaRate)/100);
        tvaCollected += (lineVal - lineNet);
      }
    }

    const purchases = await prisma.purchase.findMany({
      where: { companyId, createdAt: { gte: startDate, lte: endDate }, status: { notIn: ['RETURNED'] } },
    });
    const tvaDeductible = purchases.reduce((sum, p) => sum + asNumber(p.taxTotal), 0);

    res.json({
      tvaCollected,
      tvaDeductible,
      netTvaPayable: tvaCollected - tvaDeductible,
    });
  } catch(err) { next(err); }
});

export default router;
