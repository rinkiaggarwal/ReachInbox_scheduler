import './globals.css';
import { Providers } from '../components/providers';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ReachInbox Scheduler | Enterprise Email Job Engine',
  description: 'Production-grade Email Job Scheduler with BullMQ, Redis rate-limiting, PostgreSQL, and Elasticsearch search.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-dark text-text-body font-sans min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
