import React from 'react';
import { clsx } from 'clsx';
import { EmailStatus } from '../../types';

interface BadgeProps {
  status: EmailStatus | string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className }) => {
  const statusUpper = status.toUpperCase();

  const configs: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
    SCHEDULED: {
      label: 'Scheduled',
      dot: 'bg-zinc-400',
      bg: 'bg-zinc-900',
      text: 'text-zinc-300',
      border: 'border-zinc-700',
    },
    SENDING: {
      label: 'Sending',
      dot: 'bg-red animate-pulse',
      bg: 'bg-red-950/30',
      text: 'text-red-400',
      border: 'border-red-800/40',
    },
    SENT: {
      label: 'Sent',
      dot: 'bg-emerald-500',
      bg: 'bg-emerald-950/20',
      text: 'text-emerald-400',
      border: 'border-emerald-800/30',
    },
    FAILED: {
      label: 'Failed',
      dot: 'bg-red-600',
      bg: 'bg-red-950/40',
      text: 'text-red-400',
      border: 'border-red-800/50',
    },
  };

  const config = configs[statusUpper] || {
    label: status,
    dot: 'bg-zinc-500',
    bg: 'bg-zinc-900',
    text: 'text-zinc-400',
    border: 'border-zinc-800',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />
      <span>{config.label}</span>
    </span>
  );
};
