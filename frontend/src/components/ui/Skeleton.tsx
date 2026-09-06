import React from 'react';
import { clsx } from 'clsx';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return <div className={clsx('animate-pulse bg-bg-hover/60 rounded-md', className)} />;
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full space-y-3 p-4">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex items-center space-x-4">
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-5 w-2/4" />
          <Skeleton className="h-5 w-1/6" />
          <Skeleton className="h-5 w-1/12" />
        </div>
      ))}
    </div>
  );
};
