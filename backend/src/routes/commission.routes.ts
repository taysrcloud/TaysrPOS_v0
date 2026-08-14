import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

// Track E (people/commissions): sales commission agents. CRUD only - assigning
// an agent to a Sale and computing/reporting commission is deferred (register-
// adjacent checkout flow; see schema.prisma comment on SalesCommissionAgent).
const router = Router();

const asNumber = (value: unknown) => value && typeof value === 'object' && 'toNumber' in value
  ? (value as { toNumber: () => number }).toNumber()
  : Number(value || 0);

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const agents = await prisma.salesCommissionAgent.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
    res.json({ agents: agents.map(a => ({ ...a, commissionRate: asNumber(a.commissionRate) })) });
  } catch (err) {
    next(err);
  }
});

router.get('/report', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const agentId = req.query.agentId ? Number(req.query.agentId) : undefined;
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;

    const agents = await prisma.salesCommissionAgent.findMany({
      where: { companyId, ...(agentId ? { id: agentId } : {}) },
      orderBy: { name: 'asc' },
    });

    const whereSale: any = {
      companyId,
      commissionAgentId: { not: null },
      status: { in: ['FINAL', 'PARTIALLY_RETURNED'] },
    };
    if (agentId) whereSale.commissionAgentId = agentId;
    if (startDate || endDate) {
      whereSale.createdAt = {};
      if (startDate) whereSale.createdAt.gte = startDate;
      if (endDate) whereSale.createdAt.lte = endDate;
    }

    const sales = await prisma.sale.findMany({
      where: whereSale,
      select: {
        id: true,
        ticketNumber: true,
        total: true,
        commissionAgentId: true,
        createdAt: true,
      },
    });

    const report = agents.map(agent => {
      const rate = asNumber(agent.commissionRate);
      const agentSales = sales.filter(s => s.commissionAgentId === agent.id);
      const totalSalesAmount = agentSales.reduce((sum, s) => sum + asNumber(s.total), 0);
      const commissionEarned = Number((totalSalesAmount * (rate / 100)).toFixed(2));

      return {
        agentId: agent.id,
        agentName: agent.name,
        commissionRate: rate,
        salesCount: agentSales.length,
        totalSalesAmount,
        commissionEarned,
        sales: agentSales.map(s => ({
          id: s.id,
          reference: s.ticketNumber || `TCK-${s.id}`,
          total: asNumber(s.total),
          createdAt: s.createdAt,
          commission: Number((asNumber(s.total) * (rate / 100)).toFixed(2)),
        })),
      };
    });

    const totalCommission = report.reduce((sum, r) => sum + r.commissionEarned, 0);

    res.json({ report, summary: { totalCommission } });
  } catch (err) { next(err); }
});

router.post('/', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const parsed = z.object({
      name: z.string().trim().min(2),
      commissionRate: z.coerce.number().min(0).max(100).default(0),
    }).parse(req.body);
    const agent = await prisma.salesCommissionAgent.create({
      data: { companyId, name: parsed.name, commissionRate: parsed.commissionRate },
    });
    res.status(201).json({ success: true, agent: { ...agent, commissionRate: asNumber(agent.commissionRate) } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Agent invalide', errors: err.issues });
    next(err);
  }
});

export default router;
