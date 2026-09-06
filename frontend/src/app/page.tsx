'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center text-text-muted">
      <div className="animate-pulse flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-primary animate-ping" />
        <span className="text-sm font-semibold">Redirecting to ReachInbox Dashboard...</span>
      </div>
    </div>
  );
}
