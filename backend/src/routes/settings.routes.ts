import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole, requirePermission, DEFAULT_ROLE_PERMISSIONS, AuthRequest } from '../middleware/auth.js';

const router = Router();
const settingsSchema = z.record(z.string(), z.any());

// Track G: device activation-code issuance for the Hanout Express app. Codes
// are short and human-typeable (excludes 0/O/1/I/L to avoid transcription
// errors when an admin reads one aloud or writes it on a slip of paper).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const generateActivationCode = () =>
  Array.from({ length: 8 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');

router.post('/devices', requireAuth, requirePermission('devices.manage'), async (req: AuthRequest, res, next) => {
  try {
    const locationId = Number(req.body?.locationId);
    if (!Number.isInteger(locationId)) return res.status(400).json({ message: 'locationId requis' });
    const location = await prisma.location.findFirst({ where: { id: locationId, companyId: req.user!.companyId } });
    if (!location) return res.status(404).json({ message: 'Emplacement introuvable' });

    let activationCode = generateActivationCode();
    // Astronomically unlikely to collide (32^8 space) but retry once for safety.
    if (await prisma.device.findUnique({ where: { activationCode } })) {
      activationCode = generateActivationCode();
    }

    const device = await prisma.device.create({
      data: { companyId: req.user!.companyId, locationId, activationCode },
    });
    res.status(201).json({ id: device.id, activationCode: device.activationCode, locationId: device.locationId });
  } catch (error) { next(error); }
});

router.get('/devices', requireAuth, requirePermission('devices.manage'), async (req: AuthRequest, res, next) => {
  try {
    const devices = await prisma.device.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { createdAt: 'desc' },
      include: { location: { select: { name: true } } },
    });
    res.json(devices.map(d => ({
      id: d.id,
      locationId: d.locationId,
      locationName: d.location.name,
      activationCode: d.activationCode,
      deviceModel: d.deviceModel,
      appVersion: d.appVersion,
      activatedAt: d.activatedAt,
      lastSeenAt: d.lastSeenAt,
      revokedAt: d.revokedAt,
    })));
  } catch (error) { next(error); }
});

router.delete('/devices/:id', requireAuth, requirePermission('devices.manage'), async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const device = await prisma.device.findFirst({ where: { id, companyId: req.user!.companyId } });
    if (!device) return res.status(404).json({ message: 'Appareil introuvable' });
    await prisma.device.update({ where: { id }, data: { revokedAt: new Date() } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

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

// Track E: managing overrides is itself gated by requireRole(['ADMIN']) directly,
// not requirePermission - letting this be delegated would let a MANAGER grant
// themselves (or anyone) more access, a privilege-escalation loop the role
// system is deliberately kept as the un-overridable backstop against.

router.get('/permissions/actions', requireAuth, requireRole(['ADMIN']), async (_req: AuthRequest, res) => {
  res.json({ actions: Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([action, roles]) => ({ action, defaultRoles: roles })) });
});

router.get('/permissions/:userId', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res, next) => {
  try {
    const userId = Number(req.params.userId);
    const user = await prisma.user.findFirst({ where: { id: userId, companyId: req.user!.companyId } });
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    const overrides = await prisma.userPermission.findMany({ where: { userId }, orderBy: { action: 'asc' } });
    res.json(overrides.map(o => ({ action: o.action, granted: o.granted })));
  } catch (error) { next(error); }
});

const permissionSchema = z.object({ action: z.string().min(1), granted: z.boolean() });

router.put('/permissions/:userId', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res, next) => {
  try {
    const userId = Number(req.params.userId);
    const user = await prisma.user.findFirst({ where: { id: userId, companyId: req.user!.companyId } });
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    const { action, granted } = permissionSchema.parse(req.body);
    const override = await prisma.userPermission.upsert({
      where: { userId_action: { userId, action } },
      create: { userId, action, granted },
      update: { granted },
    });
    res.json({ action: override.action, granted: override.granted });
  } catch (error) { next(error); }
});

router.delete('/permissions/:userId/:action', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res, next) => {
  try {
    const userId = Number(req.params.userId);
    const user = await prisma.user.findFirst({ where: { id: userId, companyId: req.user!.companyId } });
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    await prisma.userPermission.deleteMany({ where: { userId, action: String(req.params.action) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

export default router;
