import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  highlight = false,
}) => {
  return (
    <div className={`card-panel p-4 rounded-lg flex items-center justify-between relative overflow-hidden ${highlight ? 'border-l-2 border-l-red' : ''}`}>
      <div>
        <p className="text-xs font-semibold text-text-sub uppercase tracking-wide">{title}</p>
        <h3 className="text-xl font-bold text-text-main mt-1">{value}</h3>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>

      <div className="w-9 h-9 rounded bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-sub">
        {icon}
      </div>
    </div>
  );
};
