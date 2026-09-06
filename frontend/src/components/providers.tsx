'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: '#13111C',
            border: '1px solid #262238',
            color: '#F3F4F6',
          },
        }}
      />
    </SessionProvider>
  );
}
