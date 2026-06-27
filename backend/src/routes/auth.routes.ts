import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma, getTenantPrisma } from '../utils/prisma.js';
import { platformDb } from '../utils/platformPrisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'taysr-super-secret-key-1234';

// Primary Login: username + password
router.post('/login', async (req, res) => {
  try {
    const { login, username, email, password, accountId } = z.object({
      login: z.string().min(1).optional(),
      username: z.string().min(1).optional(),
      email: z.string().min(1).optional(),
      password: z.string().min(1),
      accountId: z.union([z.string().min(1), z.number().int().positive()]).optional(),
    }).parse(req.body);

    const loginId = (email || username || login || '').trim();
    if (!loginId) {
      return res.status(400).json({ message: 'Identifiant requis' });
    }

    let tenantUser = null;
    let targetAccountId = undefined;
    let platformUserId = undefined;

    try {
      // 1. Try Platform Database first (Multi-tenant mode)
      const platformUser = await platformDb.findPlatformUserByEmailOrUsername(loginId);
      if (platformUser && platformUser.isActive) {
        const isValid = await bcrypt.compare(password, platformUser.password);
        if (isValid) {
          const allMemberships = await platformDb.getMemberships(platformUser.id);
          const activeMemberships = allMemberships.filter(m => m.isActive && m.status !== 'SUSPENDED' && m.status !== 'EXPIRED');
          
          if (activeMemberships.length > 0) {
            let targetMembership = activeMemberships.length === 1 ? activeMemberships[0] : null;
            if (accountId) {
              const parsedId = typeof accountId === 'string' && accountId.startsWith('ACC') ? accountId : Number(accountId);
              targetMembership = activeMemberships.find(m => m.accountId === parsedId || String(m.accountId) === String(parsedId) || m.code === parsedId);
            } else if (activeMemberships.length > 1) {
              return res.status(409).json({
                message: 'Plusieurs comptes correspondent à cet identifiant',
                requiresAccountSelection: true,
                accounts: activeMemberships.map(m => ({ accountId: m.accountId, companyName: m.accountName })),
              });
            }
            if (targetMembership) {
              const tenantPrisma = getTenantPrisma(targetMembership.databaseUrl);
              tenantUser = await tenantPrisma.user.findFirst({
                where: { OR: [{ username: platformUser.username }, { email: platformUser.email }], isActive: true },
                include: { company: true },
              });
              if (tenantUser) {
                targetAccountId = targetMembership.accountId;
                platformUserId = platformUser.id;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Platform DB login failed or not configured, falling back to standalone mode', (err as any)?.message);
    }

    // 2. Fallback to Standalone Mode (Local DB)
    if (!tenantUser) {
      tenantUser = await prisma.user.findFirst({
        where: { OR: [{ username: loginId }, { email: loginId }], isActive: true },
        include: { company: true },
      });

      if (!tenantUser) {
        return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect' });
      }

      const isValid = await bcrypt.compare(password, (tenantUser as any).passwordHash || tenantUser.password);
      if (!isValid) {
        return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect' });
      }
    }

    // 5. Issue Token
    const token = jwt.sign(
      { 
        userId: tenantUser.id, 
        username: tenantUser.username, 
        companyId: tenantUser.companyId, 
        role: tenantUser.role,
        accountId: targetAccountId,
        platformUserId: platformUserId,
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: { id: tenantUser.id, fullName: tenantUser.fullName, role: tenantUser.role, username: tenantUser.username, accountId: targetAccountId },
      company: { id: tenantUser.company.id, name: tenantUser.company.name, accountId: targetAccountId },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Requête invalide' });
    }
    console.error('Login error', error);
    res.status(500).json({ message: 'Erreur serveur: ' + ((error as any).message || 'Unknown') });
  }
});

// Quick unlock for POS lock screen
router.post('/pin-unlock', async (req, res) => {
  try {
    const { userId, pin } = z.object({
      userId: z.number().int().positive(),
      pin: z.string().length(4),
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { company: true } });
    if (!user || !user.isActive || !user.pinHash) {
      return res.status(401).json({ message: 'Utilisateur introuvable ou inactif' });
    }

    const isValid = await bcrypt.compare(pin, user.pinHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Code PIN incorrect' });
    }

    // To properly support tenant context on pin-unlock, we need databaseUrl.
    // However, pin-unlock should realistically receive the token or auth header, 
    // or rely on the fact that if they are making a pin unlock they are using the default tenant 
    // for now. To be robust, pin-unlock should probably be a protected route (`requireAuth`) 
    // or the client passes the previous token to prove tenant context.
    // For now we'll issue the token but without `databaseUrl` if we don't have it, 
    // which relies on the fallback local database. The frontend should ideally re-auth.
    const token = jwt.sign(
      { userId: user.id, username: user.username, companyId: user.companyId, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      user: { id: user.id, fullName: user.fullName, role: user.role, username: user.username, email: user.email },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Requete invalide' });
    }
    console.error('PIN unlock error', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, role: true, username: true, email: true },
      orderBy: [{ fullName: 'asc' }, { username: 'asc' }],
    });
    return res.json(users);
  } catch (error) {
    console.error('Auth users error', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { company: { select: { id: true, name: true, accountId: true, defaultCurrency: true } } },
    });
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        accountId: user.company.accountId,
      },
      company: user.company,
    });
  } catch (error) {
    console.error('Auth me error', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;
