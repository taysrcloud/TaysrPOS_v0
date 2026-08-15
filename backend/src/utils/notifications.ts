import { prisma } from './prisma.js';

export type NotificationEventType = 'LOW_STOCK' | 'PAYMENT_RECEIVED' | 'NEW_SALE';

export async function triggerNotificationEvent(
  companyId: number,
  eventType: NotificationEventType,
  data: { entityId: number; title: string; note: string; [key: string]: any }
) {
  try {
    // 1. Check if a custom NotificationTemplate exists for this event
    const template = await prisma.notificationTemplate.findFirst({
      where: { companyId, event: eventType },
    });

    let bodyText = data.note;
    if (template && template.body) {
      bodyText = template.body;
      for (const [key, val] of Object.entries(data)) {
        bodyText = bodyText.replace(new RegExp(`{{${key}}}`, 'g'), String(val));
      }
    }

    // 2. Log as a DocumentAndNote entry for audit trail
    await prisma.documentAndNote.create({
      data: {
        companyId,
        entityType: eventType,
        entityId: data.entityId,
        note: `[${data.title}] ${bodyText}`,
      },
    });
  } catch (err) {
    console.error(`Failed to trigger notification event ${eventType}:`, err);
  }
}
