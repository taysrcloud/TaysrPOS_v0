import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma, runWithTenantDatabase } from '../utils/prisma.js';
import { platformDb } from '../utils/platformPrisma.js';
import { UserRole } from '../generated/client/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'taysr-super-secret-key-1234';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    username: string;
    companyId: number;
    role: UserRole;
    accountId?: number;
    databaseUrl?: string;
    platformUserId?: number;
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  console.log("HELLO FROM REQUIREAUTH!", req.path);
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // We optionally verify the user is still active in DB
    runWithTenantDatabase(decoded.databaseUrl, async () => {
      try {
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.isActive) {
          return res.status(401).json({ message: 'User not found or inactive' });
        }

        if (decoded.accountId) {
          // Verify platform account is still active
          const memberships = await platformDb.getMemberships(decoded.platformUserId);
          const membership = memberships.find(m => m.accountId === decoded.accountId);
          if (!membership || !membership.isActive || membership.status === 'SUSPENDED' || membership.status === 'EXPIRED') {
            return res.status(403).json({ message: 'Account is suspended, expired, or user access revoked' });
          }
        }

        req.user = {
          userId: user.id,
          username: user.username,
          companyId: user.companyId,
          role: user.role,
          accountId: decoded.accountId,
          databaseUrl: decoded.databaseUrl,
          platformUserId: decoded.platformUserId,
        };
        next();
      } catch (err) {
        console.error("DEBUG REQUIREAUTH DB CATCH:", err);
        next(err);
      }
    });
  } catch (err) {
    console.error("DEBUG REQUIREAUTH VERIFY CATCH:", err);
    return res.status(401).json({ message: 'Token expired or invalid' });
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient role' });
    }

    next();
  };
};
