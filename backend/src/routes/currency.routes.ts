import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

// Track H (multi-currency): manage the per-company Currency list and its
// manually-maintained exchange rate. No live FX API - deliberately manual,
// same as how tvaRate is manually configured (see schema.prisma comment).
const router = Router();

const asNumber = (value: unknown) => value && typeof value === 'object' && 'toNumber' in value
  ? (value as { toNumber: () => number }).toNumber()
  : Number(value || 0);

const serialize = (currency: any) => ({ ...currency, rate: asNumber(currency.rate) });

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const currencies = await prisma.currency.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { code: 'asc' },
    });
    res.json({ currencies: currencies.map(serialize) });
  } catch (err) { next(err); }
});

const createSchema = z.object({
  code: z.string().trim().toUpperCase().length(3),
  name: z.string().trim().min(2),
  symbol: z.string().trim().optional(),
  rate: z.coerce.number().positive(),
});

router.post('/', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createSchema.parse(req.body);
    const companyId = req.user!.companyId;
    const existing = await prisma.currency.findUnique({ where: { companyId_code: { companyId, code: parsed.code } } });
    if (existing) return res.status(409).json({ message: `La devise ${parsed.code} existe deja` });

    const currency = await prisma.currency.create({
      data: { companyId, code: parsed.code, name: parsed.name, symbol: parsed.symbol, rate: parsed.rate },
    });
    res.status(201).json({ success: true, currency: serialize(currency) });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Devise invalide', errors: err.issues });
    next(err);
  }
});

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  symbol: z.string().trim().optional().nullable(),
  rate: z.coerce.number().positive().optional(),
  isActive: z.boolean().optional(),
});

router.put('/:id', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const companyId = req.user!.companyId;
    const existing = await prisma.currency.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: 'Devise introuvable' });

    const parsed = updateSchema.parse(req.body);
    const currency = await prisma.currency.update({
      where: { id },
      data: {
        name: parsed.name,
        symbol: parsed.symbol,
        rate: parsed.rate,
        isActive: parsed.isActive,
      },
    });
    res.json({ success: true, currency: serialize(currency) });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Devise invalide', errors: err.issues });
    next(err);
  }
});

export default router;
