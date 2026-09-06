import { prisma } from '../db/prisma';
import { emailQueue } from './email.queue';
import { indexEmail } from '../services/elasticsearch.service';

/**
 * Reconcile database state with BullMQ queue on startup.
 * Ensures zero lost sends and zero duplicate sends across restarts.
 */
export async function reconcileQueueWithDB(): Promise<void> {
  console.log('[Reconcile] DB-to-Queue reconciliation routine active.');

  try {
    const scheduledEmails = await prisma.scheduledEmail.findMany({
      where: { status: 'SCHEDULED' },
    });

    console.log(`[Reconcile] Found ${scheduledEmails.length} pending scheduled emails in database.`);

    for (const email of scheduledEmails) {
      const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
      const jobId = `email-${email.id}`;

      await emailQueue.add(
        'send-email',
        { emailId: email.id },
        {
          jobId,
          delay,
        }
      );

      await indexEmail({
        id: email.id,
        senderId: email.senderId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt.toISOString(),
        createdAt: email.createdAt.toISOString(),
      });
    }

    console.log(`[Reconcile] Reconciliation completed successfully.`);
  } catch (error) {
    console.warn('[Reconcile] Database connection status (will reconcile when DB container is active):', (error as Error).message);
  }
}
