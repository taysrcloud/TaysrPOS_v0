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

// POST /receipt/send - audit trail only. Logs receipt sending.
router.post('/send', async (req: DeviceRequest, res, next) => {
  try {
    const data = sendSchema.parse(req.body);
    const { companyId } = req.device!;

    const saleIdNum = Number(data.sale_id);
    const sale = !isNaN(saleIdNum) ? await prisma.sale.findFirst({ where: { id: saleIdNum, companyId } }) : null;
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
