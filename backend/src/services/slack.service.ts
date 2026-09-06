import axios from 'axios';
import { prisma } from '../db/prisma.js';

export interface RateLimitAlertPayload {
  senderId: string;
  senderEmail: string;
  hourlyLimit: number;
  currentCount: number;
  rescheduledUntil: Date;
}

export async function sendSlackRateLimitNotification(payload: RateLimitAlertPayload): Promise<void> {
  try {
    // Read directly from DB on every trigger (no boot caching!)
    const user = await prisma.user.findUnique({
      where: { id: payload.senderId },
      select: { slackBotToken: true, slackWebhookUrl: true, email: true },
    });

    if (!user || (!user.slackBotToken && !user.slackWebhookUrl)) {
      // Skip silently if no Slack connection exists yet
      return;
    }

    const messageText = `⚠️ *Hourly Email Limit Exceeded*\n` +
      `• *Sender:* ${payload.senderEmail || user.email}\n` +
      `• *Limit:* ${payload.hourlyLimit} emails/hour\n` +
      `• *Processed this hour:* ${payload.currentCount}\n` +
      `• *Action:* Overflow emails automatically rescheduled to start at *${payload.rescheduledUntil.toISOString()}*\n` +
      `• *Status:* Queue backpressure active. No jobs failed or dropped.`;

    if (user.slackWebhookUrl) {
      await axios.post(user.slackWebhookUrl, {
        text: messageText,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '⚠️ ReachInbox Hourly Rate Limit Reached', emoji: true },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Sender:* ${payload.senderEmail || user.email}` },
              { type: 'mrkdwn', text: `*Hourly Cap:* ${payload.hourlyLimit} emails/hr` },
              { type: 'mrkdwn', text: `*Current Count:* ${payload.currentCount}` },
              { type: 'mrkdwn', text: `*Rescheduled To:* ${payload.rescheduledUntil.toLocaleTimeString()}` },
            ],
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: '⚡ ReachInbox Rate Limiter active • Jobs shifted to next hourly window' },
            ],
          },
        ],
      });
      console.log(`[SlackService] Sent webhook alert for sender ${payload.senderEmail}`);
      return;
    }

    if (user.slackBotToken) {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: '#general', // Default channel or fallback
          text: messageText,
        },
        {
          headers: {
            Authorization: `Bearer ${user.slackBotToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`[SlackService] Sent chat.postMessage alert for sender ${payload.senderEmail}`);
    }
  } catch (error) {
    // Fail silently without crashing worker or throwing unhandled errors
    console.warn('[SlackService] Failed to send Slack alert (handled silently):', (error as Error).message);
  }
}
