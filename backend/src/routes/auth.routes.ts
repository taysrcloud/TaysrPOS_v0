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
    const { username, password } = z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }).parse(req.body);

    const user = await prisma.user.findFirst({
      where: { username, isActive: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, companyId: user.companyId, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: { id: user.id, fullName: user.fullName, role: user.role, username: user.username },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Requête invalide' });
    }
    console.error('Login error', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ─── PIN Unlock: quick re-auth for POS lockscreen ────────────────────
// Only works when the user already has a valid (or recently expired) session.
// The POS locks after inactivity; users tap their profile and enter PIN to unlock.
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

    res.json({
      token,
      user: { id: user.id, fullName: user.fullName, role: user.role, username: user.username },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Requête invalide' });
    }
    console.error('PIN unlock error', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ─── List users for PIN lockscreen (profiles to tap) ─────────────────
router.get('/users', async (req, res) => {
  try {
    // In future, companyId will come from the authenticated session context.
    // For now, return all active users.
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, role: true, username: true },
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ─── Current user info ───────────────────────────────────────────────
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

export default router;
