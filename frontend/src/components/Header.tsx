'use client';

import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Button } from './ui/Button';
import { Mail, Activity, LogOut } from 'lucide-react';
import { SlackStatus } from '../types';

interface HeaderProps {
  slackStatus?: SlackStatus;
  onOpenSlackModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ slackStatus, onOpenSlackModal }) => {
  const { data: session } = useSession();

  return (
    <header className="w-full border-b border-border-subtle bg-bg-card px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-red flex items-center justify-center text-white font-bold">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-text-main">
                REACH<span className="text-red">INBOX</span>
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-bg-elevated text-text-sub border border-border-subtle">
                SCHEDULER
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Slack Connection Button */}
          <button
            onClick={onOpenSlackModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              slackStatus?.connected
                ? 'bg-emerald-950/20 text-emerald-400 border-emerald-800/40 hover:bg-emerald-950/30'
                : 'bg-bg-elevated text-text-sub border-border-subtle hover:text-text-main'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${slackStatus?.connected ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
            <span>{slackStatus?.connected ? 'Slack Alerts Active' : 'Configure Slack'}</span>
          </button>

          {/* Bull-Board Queue Monitor */}
          <a
            href="http://localhost:5000/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-bg-elevated text-text-sub border border-border-subtle hover:text-text-main hover:border-border-strong transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Queue Monitor</span>
          </a>

          {/* User Profile */}
          {session?.user && (
            <div className="flex items-center gap-3 pl-3 border-l border-border-subtle">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-text-main leading-tight">{session.user.name}</p>
                <p className="text-[11px] text-text-muted leading-tight">{session.user.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/login' })}
                icon={<LogOut className="w-3.5 h-3.5" />}
              >
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
