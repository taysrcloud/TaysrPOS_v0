import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireDevice, DeviceRequest } from '../middleware/auth.js';

import { JWT_SECRET } from '../config.js';

const router = Router();
const DEVICE_TOKEN_TTL = '24h';

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const issueTokenPair = async (device: { id: number; companyId: number; locationId: number; deviceId: string | null }) => {
  const deviceToken = jwt.sign(
    { type: 'device', deviceRecordId: device.id, companyId: device.companyId, locationId: device.locationId, deviceId: device.deviceId },
    JWT_SECRET,
    { expiresIn: DEVICE_TOKEN_TTL }
  );
  const refreshToken = crypto.randomBytes(32).toString('hex');
  await prisma.device.update({ where: { id: device.id }, data: { refreshTokenHash: sha256(refreshToken) } });
  return { deviceToken, refreshToken };
};

const tokenResponse = async (device: { id: number; companyId: number; locationId: number; deviceId: string | null }) => {
  const { deviceToken, refreshToken } = await issueTokenPair(device);
  const company = await prisma.company.findUnique({ where: { id: device.companyId } });
  return {
    tenant_id: String(device.companyId),
    store_id: String(device.locationId),
    device_token: deviceToken,
    refresh_token: refreshToken,
    config: { currency: company?.defaultCurrency || 'MAD', sync_interval: 60 },
  };
};

const activateSchema = z.object({
  phone: z.string().trim().min(1),
  activation_code: z.string().trim().min(1),
  device_id: z.string().trim().min(1),
  device_model: z.string().trim().optional(),
  app_version: z.string().trim().optional(),
});

// POST /device/activate - one-time redemption of a code an admin generated
// from Settings (see settings.routes.ts device-management endpoints). Not
// authenticated: the activation code itself is the credential.
router.post('/activate', async (req, res, next) => {
  try {
    const data = activateSchema.parse(req.body);

    const device = await prisma.device.findUnique({ where: { activationCode: data.activation_code } });
    if (!device || device.revokedAt) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'Invalid or revoked activation code' });
    }
    if (device.deviceId && device.deviceId !== data.device_id) {
      return res.status(409).json({ error: 'already_activated', error_description: 'This code is already bound to another device' });
    }

    const updated = await prisma.device.update({
      where: { id: device.id },
      data: {
        deviceId: data.device_id,
        deviceModel: data.device_model,
        appVersion: data.app_version,
        phone: data.phone,
        activatedAt: device.activatedAt ?? new Date(),
      },
    });

    res.json(await tokenResponse(updated));
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid activation payload' });
    next(error);
  }
});

// POST /device/refresh - rotates both tokens. The client sends only
// refresh_token (no device_id), so lookup is by the token's own hash.
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.body?.refresh_token;
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing refresh_token' });
    }

    const device = await prisma.device.findUnique({ where: { refreshTokenHash: sha256(refreshToken) } });
    if (!device || device.revokedAt) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'Invalid, revoked, or expired refresh token' });
    }

    res.json(await tokenResponse(device));
  } catch (error) {
    next(error);
  }
});

// POST /device/logs - diagnostic log upload. Accept-and-drop for now; revisit
// if debugging a real device fleet in the field turns out to need retention.
router.post('/logs', requireDevice, async (_req: DeviceRequest, res) => {
  res.status(204).end();
});

export default router;
