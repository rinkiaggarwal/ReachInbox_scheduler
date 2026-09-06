import { Queue } from 'bullmq';
import { createNewRedisClient } from './redis';

export const redisConnection = createNewRedisClient();

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
  },
});

export interface ScheduledEmailJobData {
  emailId: string;
}

/**
  * Enqueue an email send job with a deterministic job ID (email-{emailId}).
 * Re-adding an existing job ID in BullMQ is a no-op, guaranteeing idempotency.
 */
export async function scheduleEmailJob(emailId: string, scheduledAt: Date): Promise<void> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  const jobId = `email-${emailId}`;

  await emailQueue.add(
    'send-email',
    { emailId },
    {
      jobId,
      delay,
    }
  );

  console.log(`[Queue] Enqueued email job ${jobId} with delay ${delay}ms`);
}
