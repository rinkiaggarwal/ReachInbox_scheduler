import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { scheduleEmailJob, emailQueue } from '../queue/email.queue';
import { indexEmail, searchEmailsInES } from '../services/elasticsearch.service';

const router = Router();

const scheduleSchema = z.object({
  senderEmail: z.string().email().optional().default('demo@reachinbox.ai'),
  senderName: z.string().optional().default('ReachInbox Demo Sender'),
  recipients: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  scheduledAt: z.string().datetime().or(z.string()),
  minDelayMs: z.number().optional().default(1000),
  hourlyLimit: z.number().optional().default(10),
});

// POST /api/emails/schedule
router.post('/schedule', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = scheduleSchema.parse(req.body);
    const scheduledDate = new Date(parsed.scheduledAt);

    if (isNaN(scheduledDate.getTime())) {
      res.status(400).json({ error: 'Invalid scheduledAt date format' });
      return;
    }

    // Find or create sender
    let sender = await prisma.user.findUnique({
      where: { email: parsed.senderEmail },
    });

    if (!sender) {
      sender = await prisma.user.create({
        data: {
          email: parsed.senderEmail,
          name: parsed.senderName,
        },
      });
    }

    const createdEmails = [];

    // Create DB records and enqueue jobs
    for (const recipient of parsed.recipients) {
      const emailRecord = await prisma.scheduledEmail.create({
        data: {
          senderId: sender.id,
          recipient,
          subject: parsed.subject,
          body: parsed.body,
          scheduledAt: scheduledDate,
          minDelayMs: parsed.minDelayMs,
          hourlyLimit: parsed.hourlyLimit,
          status: 'SCHEDULED',
        },
      });

      // Schedule in BullMQ
      await scheduleEmailJob(emailRecord.id, scheduledDate);

      // Index in Elasticsearch
      await indexEmail({
        id: emailRecord.id,
        senderId: emailRecord.senderId,
        recipient: emailRecord.recipient,
        subject: emailRecord.subject,
        body: emailRecord.body,
        status: emailRecord.status,
        scheduledAt: emailRecord.scheduledAt.toISOString(),
        createdAt: emailRecord.createdAt.toISOString(),
      });

      createdEmails.push(emailRecord);
    }

    res.status(201).json({
      success: true,
      message: `Successfully scheduled ${createdEmails.length} email(s)`,
      count: createdEmails.length,
      emails: createdEmails,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    console.error('[API] /schedule error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/emails
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, senderEmail } = req.query;

    const where: any = {};
    if (status && typeof status === 'string') {
      where.status = status.toUpperCase();
    }
    if (senderEmail && typeof senderEmail === 'string') {
      where.sender = { email: senderEmail };
    }

    const emails = await prisma.scheduledEmail.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      include: {
        sender: {
          select: { email: true, name: true },
        },
      },
    });

    res.json({ success: true, count: emails.length, emails });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/emails/search?q=
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = (req.query.q as string) || '';

    try {
      // Try Elasticsearch first
      const results = await searchEmailsInES(query);
      res.json({ success: true, source: 'elasticsearch', count: results.length, emails: results });
      return;
    } catch {
      // Fallback to database search
      console.log('[API] Elasticsearch search unavailable. Falling back to DB search.');
      const emails = await prisma.scheduledEmail.findMany({
        where: query
          ? {
              OR: [
                { subject: { contains: query } },
                { body: { contains: query } },
                { recipient: { contains: query } },
              ],
            }
          : {},
        orderBy: { scheduledAt: 'desc' },
        take: 50,
      });

      res.json({ success: true, source: 'database', count: emails.length, emails });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/emails/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Remove job from BullMQ queue
    const job = await emailQueue.getJob(`email:${id}`);
    if (job) {
      await job.remove();
    }

    // Delete DB record
    await prisma.scheduledEmail.delete({
      where: { id },
    });

    res.json({ success: true, message: `Email ${id} cancelled and deleted.` });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
