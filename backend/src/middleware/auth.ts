import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma, runWithTenantDatabase } from '../utils/prisma.js';
import { platformDb } from '../utils/platformPrisma.js';
import { UserRole } from '../generated/client/index.js';

import { JWT_SECRET } from '../config.js';

export const normalizeModules = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(module => String(module).toUpperCase());
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([module]) => module.toUpperCase());
  }
  return [];
};

export const hasModuleAccess = (req: AuthRequest, module: string) =>
  !req.user?.accountId || Boolean(req.user.planLimits?.modules?.includes(module.toUpperCase()));

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    username: string;
    companyId: number;
    role: UserRole;
    accountId?: number;
    databaseUrl?: string;
    platformUserId?: number;
    planLimits?: {
      maxProducts?: number;
      maxLocations?: number;
      maxUsers?: number;
      modules?: string[];
    };
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

        let planLimits = undefined;

        if (decoded.accountId) {
          // Verify platform account is still active
          const memberships = await platformDb.getMemberships(decoded.platformUserId);
          const membership = memberships.find(m => m.accountId === decoded.accountId);
          if (!membership || !membership.isActive || membership.status === 'SUSPENDED' || membership.status === 'EXPIRED') {
            return res.status(403).json({ message: 'Account is suspended, expired, or user access revoked' });
          }
          
          planLimits = {
            maxProducts: membership.maxProducts,
            maxLocations: membership.maxLocations,
            maxUsers: membership.maxUsers,
            modules: normalizeModules(typeof membership.modules === 'string' ? JSON.parse(membership.modules || '[]') : membership.modules),
          };
        }

        req.user = {
          userId: user.id,
          username: user.username,
          companyId: user.companyId,
          role: user.role,
          accountId: decoded.accountId,
          databaseUrl: decoded.databaseUrl,
          platformUserId: decoded.platformUserId,
          planLimits
        };
        next();
      } catch (err) {
        next(err);
      }
    });
  } catch (err) {
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

// Track E: per-user overrides on top of the role presets above, not a
// replacement for them (see the UserPermission model comment in
// schema.prisma for the full reasoning). DEFAULT_ROLE_PERMISSIONS is the
// action's fallback behavior when a user has no override row - keep every
// entry identical to what the equivalent requireRole([...]) call already
// enforces, so migrating a route from requireRole to requirePermission is a
// no-op for every user until an ADMIN actually grants or revokes something.
export const DEFAULT_ROLE_PERMISSIONS: Record<string, UserRole[]> = {
  'devices.manage': ['ADMIN', 'MANAGER'],
};

export const requirePermission = (action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const override = await prisma.userPermission.findUnique({
      where: { userId_action: { userId: req.user.userId, action } },
    });
    if (override) {
      if (override.granted) return next();
      return res.status(403).json({ message: `Forbidden: permission '${action}' has been revoked for this user` });
    }

    const allowedRoles = DEFAULT_ROLE_PERMISSIONS[action] || [];
    if (allowedRoles.includes(req.user.role)) return next();
    return res.status(403).json({ message: `Forbidden: missing permission '${action}'` });
  };
};

export interface DeviceRequest extends Request {
  device?: {
    id: number;
    companyId: number;
    locationId: number;
    deviceId: string;
  };
}

// Track G: separate auth path for handheld/mobile devices, which
// authenticate as a device bound to one Location, not a logged-in User.
// Token shape is issued/rotated by device.routes.ts (activate/refresh).
export const requireDevice = async (req: DeviceRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token', error_description: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'device') {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Not a device token' });
    }

    const device = await prisma.device.findUnique({ where: { id: decoded.deviceRecordId } });
    if (!device || device.revokedAt || device.deviceId !== decoded.deviceId) {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Device revoked or not found' });
    }

    prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }).catch(() => {});

    req.device = {
      id: device.id,
      companyId: device.companyId,
      locationId: device.locationId,
      deviceId: device.deviceId!,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token', error_description: 'Token expired or invalid' });
  }
};

export const requireModule = (module: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!hasModuleAccess(req, module)) {
      return res.status(403).json({ message: `Module ${module} non inclus dans cet abonnement` });
    }
    next();
  };
};
