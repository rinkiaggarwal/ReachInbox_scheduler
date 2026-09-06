'use client';

import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ExternalLink, Check } from 'lucide-react';
import { api } from '../lib/api-client';
import { toast } from 'sonner';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  senderEmail: string;
  onSuccess: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  senderEmail,
  onSuccess,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleOAuthConnect = () => {
    window.location.href = `http://localhost:5000/api/slack/auth?senderEmail=${encodeURIComponent(senderEmail)}`;
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      toast.error('Please enter a valid HTTP/HTTPS Slack Webhook URL');
      return;
    }

    setIsLoading(true);
    try {
      await api.saveSlackWebhook(senderEmail, webhookUrl);
      toast.success('Slack webhook saved successfully');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Slack Notifications"
      subtitle="Receive alerts when campaign rate limits are reached"
      maxWidth="md"
    >
      <div className="space-y-5">
        <div className="p-4 rounded-md bg-bg-pitch border border-border-subtle flex flex-col gap-2.5">
          <p className="text-xs text-text-sub leading-relaxed">
            Authorize Slack OAuth to post notifications into your team channels.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOAuthConnect}
            icon={<ExternalLink className="w-3.5 h-3.5" />}
          >
            Connect via Slack OAuth
          </Button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-subtle" />
          </div>
          <span className="relative bg-bg-card px-2 text-[10px] uppercase font-bold text-text-muted">
            Or
          </span>
        </div>

        <form onSubmit={handleSaveWebhook} className="space-y-4">
          <Input
            label="Incoming Webhook URL"
            placeholder="https://hooks.slack.com/services/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            hint="Paste your Slack incoming webhook URL."
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isLoading} icon={<Check className="w-3.5 h-3.5" />}>
              Save Webhook
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
