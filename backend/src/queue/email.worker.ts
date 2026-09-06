import { Worker, Job } from 'bullmq';
import { config } from '../config/env';
import { prisma } from '../db/prisma';
import { sendEmail } from '../services/mail.service';
import { indexEmail } from '../services/elasticsearch.service';
import { sendSlackRateLimitNotification } from '../services/slack.service';
import { EMAIL_QUEUE_NAME, ScheduledEmailJobData, emailQueue } from './email.queue';
import { createNewRedisClient } from './redis';

const redisClient = createNewRedisClient();

export function startEmailWorker(): Worker {
  const worker = new Worker<ScheduledEmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<ScheduledEmailJobData>) => {
      const { emailId } = job.data;
      console.log(`[Worker] Processing email job ${job.id} (EmailId: ${emailId})`);

      const email = await prisma.scheduledEmail.findUnique({
        where: { id: emailId },
        include: { sender: true },
      });

      if (!email) {
        console.warn(`[Worker] Email record ${emailId} not found in DB. Skipping.`);
        return;
      }

      if (email.status === 'SENT') {
        console.log(`[Worker] Email ${emailId} is already SENT. Skipping duplicate execution.`);
        return;
      }

      // Format current hour key (YYYYMMDDHH)
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      const hour = String(now.getUTCHours()).padStart(2, '0');
      const hourKey = `${year}${month}${day}${hour}`;

      const redisKey = `sender:${email.senderId}:${hourKey}`;
      const currentCount = await redisClient.incr(redisKey);

      if (currentCount === 1) {
        await redisClient.expire(redisKey, 7200); // 2-hour TTL
      }

      const effectiveHourlyLimit = email.hourlyLimit || config.MAX_EMAILS_PER_HOUR_PER_SENDER;

      if (currentCount > effectiveHourlyLimit) {
        console.warn(
          `[Worker] Sender ${email.sender.email} reached hourly limit (${currentCount}/${effectiveHourlyLimit}). Rescheduling job ${emailId}.`
        );

        // Calculate next top of the hour
        const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
        const delayMs = nextHour.getTime() - now.getTime();

        // Trigger Slack notification asynchronously
        sendSlackRateLimitNotification({
          senderId: email.senderId,
          senderEmail: email.sender.email,
          hourlyLimit: effectiveHourlyLimit,
          currentCount,
          rescheduledUntil: nextHour,
        });

        // Reschedule in BullMQ with new delay
        await emailQueue.add(
          'send-email',
          { emailId: email.id },
          {
            jobId: `email-${emailId}`,
            delay: delayMs,
          }
        );

        return { rescheduled: true, nextWindow: nextHour };
      }

      // Mark status as SENDING
      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: { status: 'SENDING' },
      });

      try {
        // Send email via Nodemailer/Ethereal
        const result = await sendEmail(email.recipient, email.subject, email.body);

        const updatedEmail = await prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            etherealUrl: typeof result.previewUrl === 'string' ? result.previewUrl : null,
          },
        });

        // Index in Elasticsearch
        await indexEmail({
          id: updatedEmail.id,
          senderId: updatedEmail.senderId,
          recipient: updatedEmail.recipient,
          subject: updatedEmail.subject,
          body: updatedEmail.body,
          status: updatedEmail.status,
          scheduledAt: updatedEmail.scheduledAt.toISOString(),
          sentAt: updatedEmail.sentAt ? updatedEmail.sentAt.toISOString() : null,
          createdAt: updatedEmail.createdAt.toISOString(),
        });

        console.log(`[Worker] Successfully processed and sent email ${emailId}`);
        return { success: true, emailId };
      } catch (error) {
        const errorMessage = (error as Error).message;
        console.error(`[Worker] Error sending email ${emailId}:`, errorMessage);

        const failedEmail = await prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            failedReason: errorMessage,
          },
        });

        // Index failed status in Elasticsearch
        await indexEmail({
          id: failedEmail.id,
          senderId: failedEmail.senderId,
          recipient: failedEmail.recipient,
          subject: failedEmail.subject,
          body: failedEmail.body,
          status: failedEmail.status,
          scheduledAt: failedEmail.scheduledAt.toISOString(),
          createdAt: failedEmail.createdAt.toISOString(),
        });

        throw error;
      }
    },
    {
      connection: createNewRedisClient(),
      concurrency: config.WORKER_CONCURRENCY,
      limiter: {
        max: 1,
        duration: config.MIN_DELAY_MS,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  console.log(`[Worker] BullMQ worker initialized with concurrency=${config.WORKER_CONCURRENCY}, minDelay=${config.MIN_DELAY_MS}ms`);
  return worker;
}
