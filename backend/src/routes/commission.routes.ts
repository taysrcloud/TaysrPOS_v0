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
