import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma, getTenantPrisma } from '../utils/prisma.js';
import { platformDb } from '../utils/platformPrisma.js';
import { requireAuth, AuthRequest, normalizeModules } from '../middleware/auth.js';

import { JWT_SECRET } from '../config.js';

const router = Router();

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
    let targetDatabaseUrl = undefined;
    let targetPlanLimits = undefined;
    let forceFail = false;

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
                targetDatabaseUrl = targetMembership.databaseUrl;
                targetPlanLimits = {
                  maxProducts: targetMembership.maxProducts,
                  maxLocations: targetMembership.maxLocations,
                  maxUsers: targetMembership.maxUsers,
                  modules: normalizeModules(typeof targetMembership.modules === 'string' ? JSON.parse(targetMembership.modules || '[]') : targetMembership.modules),
                };
              } else {
                forceFail = true;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Platform DB login failed or not configured, falling back to standalone mode', (err as any)?.message);
    }

    if (forceFail) {
      return res.status(401).json({ message: 'Compte mal configuré (base de données vide). Veuillez recréer le compte.' });
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

      const isValid = await bcrypt.compare(password, (tenantUser as any).passwordHash);
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
      user: { 
        id: tenantUser.id, 
        fullName: tenantUser.fullName, 
        role: tenantUser.role, 
        username: tenantUser.username, 
        accountId: targetAccountId,
        planLimits: targetPlanLimits
      },
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
router.post('/pin-unlock', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId, pin } = z.object({
      userId: z.number().int().positive(),
      pin: z.string().length(4),
    }).parse(req.body);

    if (userId !== req.user!.userId) return res.status(403).json({ message: 'Utilisateur invalide' });
    const user = await prisma.user.findFirst({ where: { id: userId, companyId: req.user!.companyId }, include: { company: true } });
    if (!user || !user.isActive || !user.pinHash) {
      return res.status(401).json({ message: 'Utilisateur introuvable ou inactif' });
    }

    const isValid = await bcrypt.compare(pin, user.pinHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Code PIN incorrect' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, companyId: user.companyId, role: user.role, accountId: req.user!.accountId, platformUserId: req.user!.platformUserId },
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

router.get('/users', requireAuth, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: req.user!.companyId, isActive: true },
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
        planLimits: req.user!.planLimits
      },
      company: user.company,
    });
  } catch (error) {
    console.error('Auth me error', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.put('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { fullName, password } = z.object({
      fullName: z.string().min(1).optional(),
      password: z.string().min(4).optional(),
    }).parse(req.body);

    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'Rien  mettre  jour' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updateData,
      select: { id: true, username: true, email: true, fullName: true, role: true, companyId: true }
    });

    return res.json({ message: 'Profil mis  jour', user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Requte invalide' });
    }
    console.error('Update me error', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;
