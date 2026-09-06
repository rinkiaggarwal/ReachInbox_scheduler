import { Router, Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../db/prisma';
import { config } from '../config/env';

const router = Router();

// GET /api/slack/auth
router.get('/auth', (req: Request, res: Response): void => {
  const senderEmail = (req.query.senderEmail as string) || 'demo@reachinbox.ai';
  const state = Buffer.from(JSON.stringify({ senderEmail })).toString('base64');

  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${config.SLACK_CLIENT_ID}&scope=chat:write,incoming-webhook&redirect_uri=${encodeURIComponent(config.SLACK_REDIRECT_URI)}&state=${state}`;

  res.redirect(slackAuthUrl);
});

// GET /api/slack/callback
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query;

  if (!code || typeof code !== 'string') {
    res.status(400).send('Missing authorization code');
    return;
  }

  let senderEmail = 'demo@reachinbox.ai';
  if (state && typeof state === 'string') {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      if (decoded.senderEmail) senderEmail = decoded.senderEmail;
    } catch {
      // fallback to default
    }
  }

  try {
    const tokenResponse = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        client_id: config.SLACK_CLIENT_ID,
        client_secret: config.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: config.SLACK_REDIRECT_URI,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    if (!tokenResponse.data.ok) {
      console.error('[SlackOAuth] Failed token exchange:', tokenResponse.data);
      res.redirect(`${config.FRONTEND_URL}/dashboard?slack=error&reason=${encodeURIComponent(tokenResponse.data.error)}`);
      return;
    }

    const botToken = tokenResponse.data.access_token;
    const webhookUrl = tokenResponse.data.incoming_webhook?.url;

    // Save to user record in Postgres
    await prisma.user.upsert({
      where: { email: senderEmail },
      update: {
        slackBotToken: botToken || null,
        slackWebhookUrl: webhookUrl || null,
      },
      create: {
        email: senderEmail,
        name: senderEmail.split('@')[0],
        slackBotToken: botToken || null,
        slackWebhookUrl: webhookUrl || null,
      },
    });

    console.log(`[SlackOAuth] Successfully connected Slack for user ${senderEmail}`);
    res.redirect(`${config.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (error) {
    console.error('[SlackOAuth] Callback error:', error);
    res.redirect(`${config.FRONTEND_URL}/dashboard?slack=error`);
  }
});

// POST /api/slack/webhook (Direct incoming webhook configuration for instant dev testing)
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const { senderEmail = 'demo@reachinbox.ai', webhookUrl } = req.body;

    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
      res.status(400).json({ error: 'Valid Slack Webhook URL is required' });
      return;
    }

    const user = await prisma.user.upsert({
      where: { email: senderEmail },
      update: { slackWebhookUrl: webhookUrl },
      create: {
        email: senderEmail,
        name: senderEmail.split('@')[0],
        slackWebhookUrl: webhookUrl,
      },
    });

    res.json({
      success: true,
      message: `Slack incoming webhook saved for ${senderEmail}`,
      slackWebhookUrl: user.slackWebhookUrl,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/slack/status
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const senderEmail = (req.query.senderEmail as string) || 'demo@reachinbox.ai';
    const user = await prisma.user.findUnique({
      where: { email: senderEmail },
      select: { slackBotToken: true, slackWebhookUrl: true },
    });

    const isConnected = !!(user && (user.slackBotToken || user.slackWebhookUrl));
    res.json({
      connected: isConnected,
      hasBotToken: !!user?.slackBotToken,
      hasWebhook: !!user?.slackWebhookUrl,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
