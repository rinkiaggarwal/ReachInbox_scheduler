import { ScheduledEmail, ScheduleCampaignPayload, SlackStatus } from '../types';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(errorData.error || errorData.message || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Emails
  scheduleCampaign: (payload: ScheduleCampaignPayload) =>
    fetcher<{ success: boolean; count: number; emails: ScheduledEmail[] }>('/api/emails/schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getEmails: (params?: { status?: string; senderEmail?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.senderEmail) query.append('senderEmail', params.senderEmail);
    return fetcher<{ success: boolean; count: number; emails: ScheduledEmail[] }>(
      `/api/emails?${query.toString()}`
    );
  },

  searchEmails: (query: string) =>
    fetcher<{ success: boolean; source: 'elasticsearch' | 'database'; count: number; emails: ScheduledEmail[] }>(
      `/api/emails/search?q=${encodeURIComponent(query)}`
    ),

  cancelEmail: (id: string) =>
    fetcher<{ success: boolean; message: string }>(`/api/emails/${id}`, {
      method: 'DELETE',
    }),

  // Slack
  getSlackStatus: (senderEmail: string) =>
    fetcher<SlackStatus>(`/api/slack/status?senderEmail=${encodeURIComponent(senderEmail)}`),

  saveSlackWebhook: (senderEmail: string, webhookUrl: string) =>
    fetcher<{ success: boolean; message: string }>('/api/slack/webhook', {
      method: 'POST',
      body: JSON.stringify({ senderEmail, webhookUrl }),
    }),
};
