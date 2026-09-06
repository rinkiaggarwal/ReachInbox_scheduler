export type EmailStatus = 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED';

export interface User {
  id: string;
  email: string;
  name?: string;
  slackBotToken?: string;
  slackWebhookUrl?: string;
}

export interface ScheduledEmail {
  id: string;
  senderId: string;
  sender?: {
    email: string;
    name?: string;
  };
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  failedReason?: string | null;
  minDelayMs: number;
  hourlyLimit: number;
  etherealUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleCampaignPayload {
  senderEmail?: string;
  senderName?: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: string;
  minDelayMs?: number;
  hourlyLimit?: number;
}

export interface SlackStatus {
  connected: boolean;
  hasBotToken: boolean;
  hasWebhook: boolean;
}
