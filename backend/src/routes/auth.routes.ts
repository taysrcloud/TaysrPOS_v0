import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'taysr-super-secret-key-1234';

// ─── Primary Login: username + password ──────────────────────────────
// This is the first login when a user opens the app in a browser.
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
    const normalizedEmail = loginId.toLowerCase();
    if (!loginId) {
      return res.status(400).json({ message: 'Identifiant requis' });
    }

    const candidates = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [{ username: loginId }, { email: normalizedEmail }],
        ...(accountId ? { company: { accountId: String(accountId) } } : {}),
      },
      include: { company: { select: { id: true, name: true, accountId: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    if (candidates.length === 0) {
      return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect' });
    }

    const validCandidates = [];
    for (const candidate of candidates) {
      const isValid = await bcrypt.compare(password, candidate.passwordHash);
      if (isValid) validCandidates.push(candidate);
    }

    if (validCandidates.length === 0) {
      return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect' });
    }

    if (!accountId && validCandidates.length > 1) {
      return res.status(409).json({
        message: 'Plusieurs comptes POS correspondent a cet identifiant',
        requiresAccountSelection: true,
        accounts: validCandidates.map(candidate => ({
          accountId: candidate.company.accountId,
          companyName: candidate.company.name,
        })),
      });
    }

    const user = validCandidates[0];
    const token = jwt.sign(
      { userId: user.id, username: user.username, companyId: user.companyId, role: user.role, accountId: user.company.accountId },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: { id: user.id, fullName: user.fullName, role: user.role, username: user.username, email: user.email, accountId: user.company.accountId },
      company: { id: user.company.id, name: user.company.name, accountId: user.company.accountId },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Requ??te invalide' });
    }
    console.error('Login error', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});



// Quick unlock for POS lock screen
router.post('/pin-unlock', async (req, res) => {
  try {
    const { userId, pin } = z.object({
      userId: z.number().int().positive(),
      pin: z.string().length(4),
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || !user.pinHash) {
      return res.status(401).json({ message: 'Utilisateur introuvable ou inactif' });
    }

    const isValid = await bcrypt.compare(pin, user.pinHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Code PIN incorrect' });
    }

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
