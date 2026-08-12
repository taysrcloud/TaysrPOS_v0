import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole, AuthRequest, hasModuleAccess } from '../middleware/auth.js';

const router = Router();
const settingsSchema = z.record(z.string(), z.any());

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const company = await prisma.company.findFirst({ where: { id: req.user!.companyId } });
    if (!company) return res.status(404).json({ message: 'Entreprise introuvable' });
    const stored = company.settings && typeof company.settings === 'object' && !Array.isArray(company.settings) ? company.settings : {};
    res.json({
      ...stored,
      companyName: company.name,
      address: company.address || '',
      phone: company.phone || '',
      email: company.email || '',
      currency: company.defaultCurrency,
      defaultTva: String(company.defaultTvaRate),
      restaurantEnabled: hasModuleAccess(req, 'RESTAURANT') && company.restaurantEnabled,
      logoUrl: company.logoUrl || (stored as any).logoUrl || null,
      rc: company.rc || '',
      ice: company.ice || '',
      if: company.ifNumber || '',
      patente: company.patente || '',
    });
  } catch (error) { next(error); }
});

router.put('/', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const parsed = settingsSchema.parse(req.body);
    if (parsed.restaurantEnabled === true && !hasModuleAccess(req, 'RESTAURANT')) {
      return res.status(403).json({ message: 'Le module Restaurant doit etre active depuis Super Admin.' });
    }
    const logoUrl = typeof parsed.logoUrl === 'string' && !parsed.logoUrl.startsWith('blob:') ? parsed.logoUrl : undefined;
    const existingCompany = await prisma.company.findUnique({ where: { id: req.user!.companyId } });
    if (!existingCompany) return res.status(404).json({ message: 'Entreprise introuvable' });
    const currentSettings = existingCompany.settings && typeof existingCompany.settings === 'object' && !Array.isArray(existingCompany.settings) ? existingCompany.settings as Record<string, any> : {};
    const mergedSettings = { ...currentSettings, ...parsed, ...(logoUrl ? { logoUrl } : parsed.logoUrl === null ? { logoUrl: null } : {}) };
    const company = await prisma.company.update({
      where: { id: req.user!.companyId },
      data: {
        name: String(parsed.companyName || '').trim() || undefined,
        address: typeof parsed.address === 'string' ? parsed.address : undefined,
        phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
        email: typeof parsed.email === 'string' ? parsed.email : undefined,
        defaultCurrency: typeof parsed.currency === 'string' ? parsed.currency : undefined,
        defaultTvaRate: Number.isFinite(Number(parsed.defaultTva)) ? Number(parsed.defaultTva) : undefined,
        restaurantEnabled: typeof parsed.restaurantEnabled === 'boolean' ? parsed.restaurantEnabled : undefined,
        logoUrl,
        rc: typeof parsed.rc === 'string' ? parsed.rc : undefined,
        ice: typeof parsed.ice === 'string' ? parsed.ice : undefined,
        ifNumber: typeof parsed.if === 'string' ? parsed.if : undefined,
        patente: typeof parsed.patente === 'string' ? parsed.patente : undefined,
        settings: mergedSettings,
      },
    });
    res.json({ success: true, companyId: company.id, settings: company.settings });
  } catch (error) { next(error); }
});

export default router;
