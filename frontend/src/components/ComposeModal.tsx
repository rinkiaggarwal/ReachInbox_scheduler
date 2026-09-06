'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Upload, Mail, Clock, Zap, Check, Trash2, FileText } from 'lucide-react';
import { api } from '../lib/api-client';
import { toast } from 'sonner';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senderEmail: string;
  senderName?: string;
  onCampaignCreated: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  senderEmail,
  senderName,
  onCampaignCreated,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [rawEmailsInput, setRawEmailsInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  const defaultStartTime = new Date(Date.now() + 60000).toISOString().slice(0, 16);
  const [scheduledAt, setScheduledAt] = useState(defaultStartTime);
  const [minDelayMs, setMinDelayMs] = useState(1000);
  const [hourlyLimit, setHourlyLimit] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const processEmailList = (emails: string[]) => {
    const valid: string[] = [];
    let skipped = 0;

    emails.forEach((raw) => {
      const clean = raw.trim();
      if (clean && validateEmail(clean)) {
        if (!valid.includes(clean)) valid.push(clean);
      } else if (clean) {
        skipped++;
      }
    });

    setRecipients(valid);
    setSkippedCount(skipped);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse(file, {
      complete: (results) => {
        const extracted: string[] = [];
        results.data.forEach((row: any) => {
          if (typeof row === 'string') {
            extracted.push(row);
          } else if (Array.isArray(row)) {
            row.forEach((cell) => extracted.push(String(cell)));
          } else if (typeof row === 'object' && row !== null) {
            Object.values(row).forEach((val) => extracted.push(String(val)));
          }
        });
        processEmailList(extracted);
        toast.success(`Parsed ${file.name} successfully`);
      },
      error: (err) => {
        toast.error(`CSV Error: ${err.message}`);
      },
    });
  };

  const handleRawTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawEmailsInput(text);
    const splitEmails = text.split(/[\n,;]+/).map((s) => s.trim());
    processEmailList(splitEmails);
  };

  const handleResetLeads = () => {
    setRecipients([]);
    setSkippedCount(0);
    setFileName(null);
    setRawEmailsInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      toast.error('Subject line is required');
      return;
    }
    if (!body.trim()) {
      toast.error('Email body is required');
      return;
    }
    if (recipients.length === 0) {
      toast.error('Add at least one valid recipient email');
      return;
    }

    const startDate = new Date(scheduledAt);
    if (isNaN(startDate.getTime())) {
      toast.error('Invalid schedule date/time');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.scheduleCampaign({
        senderEmail,
        senderName,
        recipients,
        subject,
        body,
        scheduledAt: startDate.toISOString(),
        minDelayMs,
        hourlyLimit,
      });

      toast.success(`Campaign scheduled for ${recipients.length} recipients`);
      onCampaignCreated();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Email Campaign"
      subtitle="Configure payload, upload lead recipients, and schedule execution"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Subject */}
        <Input
          label="Subject Line"
          placeholder="Enter email subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />

        {/* Recipients Upload */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text-sub uppercase tracking-wide">
              Recipients List
            </label>
            {recipients.length > 0 && (
              <button
                type="button"
                onClick={handleResetLeads}
                className="text-xs text-red hover:text-red-bright flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Clear Recipients
              </button>
            )}
          </div>

          <div className="border border-dashed border-border-subtle hover:border-border-strong bg-bg-pitch rounded-md p-3 transition-colors">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              className="flex items-center justify-center gap-2 cursor-pointer py-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="w-4 h-4 text-text-muted" />
              <span className="text-xs font-medium text-text-sub">
                {fileName ? `File: ${fileName}` : 'Upload CSV or Text list'}
              </span>
            </div>
          </div>

          {!fileName && (
            <textarea
              rows={2}
              placeholder="Or paste recipient email addresses separated by commas or newlines..."
              value={rawEmailsInput}
              onChange={handleRawTextChange}
              className="w-full bg-bg-pitch border border-border-subtle rounded-md p-2.5 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-red"
            />
          )}

          <div className="flex items-center gap-3 text-xs pt-0.5">
            <span className="text-emerald-400 font-medium">
              {recipients.length} valid recipient(s)
            </span>
            {skippedCount > 0 && (
              <span className="text-red-400 font-medium">
                {skippedCount} invalid/skipped
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-sub uppercase tracking-wide">
            Email Content
          </label>
          <textarea
            rows={4}
            placeholder="Write email body content..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full bg-bg-pitch border border-border-subtle rounded-md p-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-red"
            required
          />
        </div>

        {/* Schedule & Rate Limiting Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border-subtle">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-text-sub uppercase">Start Time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full bg-bg-pitch border border-border-subtle rounded-md px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-red"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-text-sub uppercase">Min Delay (ms)</label>
            <input
              type="number"
              min={100}
              step={500}
              value={minDelayMs}
              onChange={(e) => setMinDelayMs(Number(e.target.value))}
              className="w-full bg-bg-pitch border border-border-subtle rounded-md px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-red"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-text-sub uppercase">Hourly Sender Limit</label>
            <input
              type="number"
              min={1}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              className="w-full bg-bg-pitch border border-border-subtle rounded-md px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-red"
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            icon={<Mail className="w-3.5 h-3.5" />}
          >
            Schedule Campaign ({recipients.length})
          </Button>
        </div>
      </form>
    </Modal>
  );
};
