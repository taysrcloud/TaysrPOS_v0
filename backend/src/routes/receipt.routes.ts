import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { DeviceRequest } from '../middleware/auth.js';

const router = Router();

const sendSchema = z.object({
  phone: z.string().min(1),
  sale_id: z.string().min(1),
  message: z.string().min(1),
});

// POST /receipt/send - audit trail only. Hanout Express sends the WhatsApp
// message itself (opens a wa.me deep link client-side); this just logs that
// it happened. sale_id is the client-generated UUID from sync/batch
// (Sale.externalId) - if that sale hasn't synced yet, log without a link
// rather than fail a delivery the client already made.
router.post('/send', async (req: DeviceRequest, res, next) => {
  try {
    const data = sendSchema.parse(req.body);
    const { companyId } = req.device!;

    const sale = await prisma.sale.findFirst({ where: { externalId: data.sale_id, companyId } });
    if (sale) {
      await prisma.documentAndNote.create({
        data: {
          companyId,
          entityType: 'sale',
          entityId: sale.id,
          note: `Recu WhatsApp envoye a ${data.phone}`,
        },
      });
    }

    res.status(204).end();
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid receipt payload' });
    next(error);
  }
});

export default router;
