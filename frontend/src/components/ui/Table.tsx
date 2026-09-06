import React from 'react';
import { TableSkeleton } from './Skeleton';
import { Mail } from 'lucide-react';

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
}

export function Table<T extends { id: string | number }>({
  columns,
  data,
  isLoading,
  emptyTitle = 'No emails found',
  emptySubtitle = 'Schedule a new campaign to populate the queue.',
}: TableProps<T>) {
  if (isLoading) {
    return <TableSkeleton rows={5} />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-border-subtle rounded-lg bg-bg-card/50">
        <div className="w-10 h-10 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted mb-3">
          <Mail className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-semibold text-text-main">{emptyTitle}</h4>
        <p className="text-xs text-text-muted mt-1 max-w-sm">{emptySubtitle}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto border border-border-subtle rounded-lg bg-bg-card">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border-subtle bg-bg-elevated text-[11px] font-semibold text-text-sub uppercase tracking-wider">
            {columns.map((col, idx) => (
              <th key={idx} className={`px-5 py-3 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle text-xs font-normal">
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-bg-elevated/60 transition-colors">
              {columns.map((col, idx) => (
                <td key={idx} className={`px-5 py-3.5 text-text-main ${col.className || ''}`}>
                  {col.cell
                    ? col.cell(item)
                    : col.accessorKey
                    ? String(item[col.accessorKey] ?? '')
                    : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
