import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { UserRole } from '../generated/client/index.js';

const router = Router();

const sanitizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'admin';

const mapPlatformRole = (role?: string): UserRole => {
  if (role === 'ADMIN') return UserRole.ADMIN;
  if (role === 'MANAGER') return UserRole.MANAGER;
  if (role === 'WAITER') return UserRole.WAITER;
  if (role === 'KITCHEN') return UserRole.KITCHEN;
  if (role === 'CASHIER') return UserRole.CASHIER;
  return UserRole.USER;
};

const provisionSchema = z.object({
  platform_account_id: z.union([z.string().min(1), z.number().int().positive()]),
  platform_account_code: z.string().min(1).optional(),
  name: z.string().min(2),
  legal_name: z.string().optional().nullable(),
  username: z.string().min(1).optional().nullable(),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  first_name: z.string().min(1).optional().nullable(),
  role: z.string().min(1).optional(),
  is_active: z.boolean().optional().default(true),
  currency_code: z.string().min(1).optional().default('MAD'),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
  morocco_ice: z.string().optional().nullable(),
  morocco_rc: z.string().optional().nullable(),
  morocco_if: z.string().optional().nullable(),
  morocco_tp: z.string().optional().nullable(),
  morocco_cnss: z.string().optional().nullable(),
  modules: z.object({
    pos: z.boolean().optional(),
    restaurant: z.boolean().optional(),
    invoice: z.boolean().optional(),
    optic: z.boolean().optional(),
    multiWarehouse: z.boolean().optional(),
  }).optional(),
  features: z.record(z.string(), z.any()).optional(),
});

router.post('/provision-tenant', async (req, res) => {
  const expectedSecret = process.env.TAYSRPOS_PROVISIONING_SECRET || 'secret';
  const receivedSecret = req.header('X-Platform-Secret');
  if (!receivedSecret || receivedSecret !== expectedSecret) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const data = provisionSchema.parse(req.body);
    const accountId = String(data.platform_account_id);
    const loginEmail = data.email.trim().toLowerCase();
    const fallbackUsername = data.platform_account_code ? `admin-${data.platform_account_code}` : `admin-${accountId}`;
    const resolvedUsername = sanitizeUsername(data.username || loginEmail.split('@')[0] || fallbackUsername);
    const fullName = (data.first_name || resolvedUsername).trim();
    const role = mapPlatformRole(data.role);
    const modules = {
      pos: data.modules?.pos ?? true,
      restaurant: data.modules?.restaurant ?? Boolean(data.features?.restaurant),
      invoice: data.modules?.invoice ?? Boolean(data.features?.invoice),
      optic: data.modules?.optic ?? Boolean(data.features?.optic),
      multiWarehouse: data.modules?.multiWarehouse ?? Boolean(data.features?.multiBranches || data.features?.multiWarehouses),
    };

    const company = await prisma.company.upsert({
      where: { accountId },
      update: {
        name: data.name,
        legalName: data.legal_name || data.name,
        email: loginEmail,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        logoUrl: data.logo_url || null,
        ice: data.morocco_ice || null,
        ifNumber: data.morocco_if || null,
        rc: data.morocco_rc || null,
        patente: data.morocco_tp || null,
        cnss: data.morocco_cnss || null,
        defaultCurrency: data.currency_code || 'MAD',
        posEnabled: modules.pos,
        restaurantEnabled: modules.restaurant,
        invoiceEnabled: modules.invoice,
        opticEnabled: modules.optic,
        multiWarehouse: modules.multiWarehouse,
      },
      create: {
        accountId,
        name: data.name,
        legalName: data.legal_name || data.name,
        email: loginEmail,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        logoUrl: data.logo_url || null,
        ice: data.morocco_ice || null,
        ifNumber: data.morocco_if || null,
        rc: data.morocco_rc || null,
        patente: data.morocco_tp || null,
        cnss: data.morocco_cnss || null,
        defaultCurrency: data.currency_code || 'MAD',
        posEnabled: modules.pos,
        restaurantEnabled: modules.restaurant,
        invoiceEnabled: modules.invoice,
        opticEnabled: modules.optic,
        multiWarehouse: modules.multiWarehouse,
      },
    });

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const existingUser = await prisma.user.findFirst({
      where: {
        companyId: company.id,
        OR: [{ email: loginEmail }, { username: resolvedUsername }],
      },
    });

    if (!existingUser && !passwordHash) {
      return res.status(400).json({ message: 'Password is required for first tenant provisioning' });
    }

    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            username: resolvedUsername,
            email: loginEmail,
            fullName,
            role,
            isActive: data.is_active,
            ...(passwordHash ? { passwordHash } : {}),
          },
        })
      : await prisma.user.create({
          data: {
            companyId: company.id,
            username: resolvedUsername,
            email: loginEmail,
            passwordHash: passwordHash!,
            fullName,
            role,
            isActive: data.is_active,
          },
        });

    const location = await prisma.location.upsert({
      where: { companyId_name: { companyId: company.id, name: 'Magasin principal' } },
      update: {
        address: data.address || null,
        isActive: true,
      },
      create: {
        companyId: company.id,
        name: 'Magasin principal',
        address: data.address || null,
        isActive: true,
      },
    });

    await prisma.warehouse.upsert({
      where: { companyId_name: { companyId: company.id, name: 'Stock principal' } },
      update: {
        locationId: location.id,
        isMain: true,
        isActive: true,
      },
      create: {
        companyId: company.id,
        locationId: location.id,
        name: 'Stock principal',
        isMain: true,
        isActive: true,
      },
    });

    const walkInCustomer = await prisma.contact.findFirst({
      where: { companyId: company.id, type: 'CUSTOMER', fullName: 'Walk-In Customer' },
    });
    if (!walkInCustomer) {
      await prisma.contact.create({
        data: {
          companyId: company.id,
          type: 'CUSTOMER',
          fullName: 'Walk-In Customer',
          isActive: true,
        },
      });
    }

    return res.json({
      synced: true,
      target: 'TaysrPOS_v0',
      company: {
        id: company.id,
        accountId: company.accountId,
        name: company.name,
        modules,
      },
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid provisioning payload', errors: error.issues });
    }
    console.error('POS v0 provision tenant error', error);
    return res.status(500).json({ message: 'Provisioning failed' });
  }
});

export default router;
