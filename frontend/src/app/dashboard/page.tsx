'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '../../components/Header';
import { StatCard } from '../../components/StatCard';
import { Tabs } from '../../components/ui/Tabs';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ComposeModal } from '../../components/ComposeModal';
import { SlackModal } from '../../components/SlackModal';
import { ScheduledEmail, SlackStatus } from '../../types';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import {
  Clock,
  Send,
  Search,
  Plus,
  ExternalLink,
  Trash2,
  RefreshCw,
  Zap,
  CheckCircle2,
  Database,
} from 'lucide-react';

function DashboardContent() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const senderEmail = session?.user?.email || 'demo@reachinbox.ai';
  const senderName = session?.user?.name || 'Alex Growth';

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'search'>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [sentEmails, setSentEmails] = useState<ScheduledEmail[]>([]);
  const [searchResults, setSearchResults] = useState<ScheduledEmail[]>([]);
  const [searchSource, setSearchSource] = useState<string>('elasticsearch');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const [slackStatus, setSlackStatus] = useState<SlackStatus>({
    connected: false,
    hasBotToken: false,
    hasWebhook: false,
  });

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);

  useEffect(() => {
    const slackParam = searchParams.get('slack');
    if (slackParam === 'connected') {
      toast.success('Slack connected successfully');
    } else if (slackParam === 'error') {
      toast.error(`Slack error: ${searchParams.get('reason') || 'Authorization failed'}`);
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [scheduledRes, sentRes, slackRes] = await Promise.all([
        api.getEmails({ status: 'SCHEDULED', senderEmail }),
        api.getEmails({ senderEmail }),
        api.getSlackStatus(senderEmail).catch(() => ({ connected: false, hasBotToken: false, hasWebhook: false })),
      ]);

      if (scheduledRes.success) setScheduledEmails(scheduledRes.emails);
      if (sentRes.success) {
        setSentEmails(sentRes.emails.filter((e) => e.status === 'SENT' || e.status === 'FAILED'));
      }
      setSlackStatus(slackRes);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [senderEmail]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login');
    } else if (authStatus === 'authenticated') {
      loadData();
    }
  }, [authStatus, loadData, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await api.searchEmails(searchQuery);
      setSearchResults(res.emails);
      setSearchSource(res.source);
    } catch (err) {
      toast.error(`Search error: ${(err as Error).message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCancelEmail = async (id: string) => {
    try {
      await api.cancelEmail(id);
      toast.success('Email cancelled and removed from queue');
      loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const totalScheduled = scheduledEmails.length;
  const totalSent = sentEmails.filter((e) => e.status === 'SENT').length;
  const totalFailed = sentEmails.filter((e) => e.status === 'FAILED').length;
  const deliveryRate = totalSent + totalFailed > 0 ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 100;

  const scheduledColumns = [
    {
      header: 'Recipient',
      cell: (item: ScheduledEmail) => (
        <div>
          <p className="font-semibold text-text-main">{item.recipient}</p>
          <p className="text-[11px] text-text-muted">ID: {item.id.slice(0, 8)}</p>
        </div>
      ),
    },
    {
      header: 'Subject',
      cell: (item: ScheduledEmail) => (
        <span className="text-text-sub line-clamp-1 max-w-xs">{item.subject}</span>
      ),
    },
    {
      header: 'Scheduled Send Time',
      cell: (item: ScheduledEmail) => (
        <span className="text-xs text-text-sub">
          {new Date(item.scheduledAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Limits Config',
      cell: (item: ScheduledEmail) => (
        <span className="text-xs text-text-muted">
          {item.minDelayMs}ms delay • {item.hourlyLimit}/hr cap
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (item: ScheduledEmail) => <Badge status={item.status} />,
    },
    {
      header: 'Action',
      cell: (item: ScheduledEmail) => (
        <button
          onClick={() => handleCancelEmail(item.id)}
          className="p-1 rounded text-text-muted hover:text-red transition-colors cursor-pointer"
          title="Cancel Email Job"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  const sentColumns = [
    {
      header: 'Recipient',
      cell: (item: ScheduledEmail) => (
        <div>
          <p className="font-semibold text-text-main">{item.recipient}</p>
          <p className="text-[11px] text-text-muted">{item.sender?.email || senderEmail}</p>
        </div>
      ),
    },
    {
      header: 'Subject',
      cell: (item: ScheduledEmail) => (
        <span className="text-text-sub line-clamp-1 max-w-xs">{item.subject}</span>
      ),
    },
    {
      header: 'Executed At',
      cell: (item: ScheduledEmail) => (
        <span className="text-xs text-text-muted">
          {item.sentAt ? new Date(item.sentAt).toLocaleString() : new Date(item.updatedAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (item: ScheduledEmail) => <Badge status={item.status} />,
    },
    {
      header: 'Ethereal Mail Preview',
      cell: (item: ScheduledEmail) => (
        item.etherealUrl ? (
          <a
            href={item.etherealUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-red hover:underline font-medium"
          >
            <span>View Inbox Preview</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-xs text-text-muted">{item.failedReason || 'N/A'}</span>
        )
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-bg-pitch text-text-main flex flex-col">
      <Header slackStatus={slackStatus} onOpenSlackModal={() => setIsSlackOpen(true)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        {/* Banner Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-lg bg-bg-card border border-border-subtle">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-text-main">
              Campaign Queue Overview
            </h2>
            <p className="text-xs text-text-muted mt-0.5 max-w-xl">
              Automated campaign scheduling engine backed by Redis BullMQ, PostgreSQL persistence, and sender rate limiting.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsComposeOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              + Create Campaign
            </Button>
          </div>
        </div>

        {/* Analytics Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending Queue"
            value={totalScheduled}
            subtitle="Scheduled in BullMQ"
            icon={<Clock className="w-4 h-4 text-text-main" />}
            highlight={true}
          />
          <StatCard
            title="Emails Sent"
            value={totalSent}
            subtitle="Delivered via SMTP"
            icon={<Send className="w-4 h-4 text-text-main" />}
          />
          <StatCard
            title="Delivery Success"
            value={`${deliveryRate}%`}
            subtitle={`${totalFailed} failed sends`}
            icon={<CheckCircle2 className="w-4 h-4 text-text-main" />}
          />
          <StatCard
            title="Hourly Limiter"
            value={slackStatus.connected ? 'Slack Active' : 'Cap: 10/hr'}
            subtitle="Auto-reschedules overflow"
            icon={<Zap className="w-4 h-4 text-text-main" />}
          />
        </div>

        {/* Tabs & Content */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Tabs
              tabs={[
                { id: 'scheduled', label: 'Scheduled Queue', count: totalScheduled, icon: <Clock className="w-3.5 h-3.5" /> },
                { id: 'sent', label: 'Sent History', count: sentEmails.length, icon: <Send className="w-3.5 h-3.5" /> },
                { id: 'search', label: 'Elasticsearch Query', icon: <Database className="w-3.5 h-3.5" /> },
              ]}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as any)}
            />

            {activeTab !== 'search' && (
              <div className="w-full sm:w-60">
                <Input
                  placeholder="Filter emails..."
                  icon={<Search className="w-3.5 h-3.5 text-text-muted" />}
                  onChange={(e) => {
                    const q = e.target.value.toLowerCase();
                    if (!q) {
                      loadData();
                    } else if (activeTab === 'scheduled') {
                      setScheduledEmails((prev) => prev.filter((item) => item.recipient.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q)));
                    } else {
                      setSentEmails((prev) => prev.filter((item) => item.recipient.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q)));
                    }
                  }}
                />
              </div>
            )}
          </div>

          {activeTab === 'scheduled' && (
            <Table
              columns={scheduledColumns}
              data={scheduledEmails}
              isLoading={isLoading}
              emptyTitle="No Pending Emails in Queue"
              emptySubtitle="Click '+ Create Campaign' to schedule sequence emails."
            />
          )}

          {activeTab === 'sent' && (
            <Table
              columns={sentColumns}
              data={sentEmails}
              isLoading={isLoading}
              emptyTitle="No Sent Email History"
              emptySubtitle="Delivered emails will appear here automatically."
            />
          )}

          {activeTab === 'search' && (
            <div className="space-y-3">
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search subject, content, or recipient across Elasticsearch..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={<Search className="w-3.5 h-3.5" />}
                  />
                </div>
                <Button type="submit" variant="primary" size="md" isLoading={isSearching} icon={<Search className="w-3.5 h-3.5" />}>
                  Query ES
                </Button>
              </form>

              {searchResults.length > 0 && (
                <p className="text-xs text-text-muted px-1">
                  Found {searchResults.length} document(s) via <span className="text-text-main font-medium">{searchSource}</span>
                </p>
              )}

              <Table
                columns={sentColumns}
                data={searchResults}
                isLoading={isSearching}
                emptyTitle="Search Index"
                emptySubtitle="Enter search terms above to query the full-text search index."
              />
            </div>
          )}
        </div>
      </main>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senderEmail={senderEmail}
        senderName={senderName}
        onCampaignCreated={loadData}
      />

      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        senderEmail={senderEmail}
        onSuccess={loadData}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-pitch flex items-center justify-center text-text-muted">Loading Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
