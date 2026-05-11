'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from 'sonner';
import { type ReactNode } from 'react';

/**
 * Client-side providers wrapper.
 * - ThemeProvider: 4 themes (light / dark / dark-blue / system), no flash on load
 * - QueryClientProvider: React Query cache
 * - Toaster: global toast notifications (sonner)
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      themes={['light', 'dark', 'dark-blue']}
      enableSystem={true}
      disableTransitionOnChange={false}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--surface, #1a1a2e)',
              color: 'var(--text, #e2e8f0)',
              border: '1px solid var(--border, #2d2d4e)',
              borderRadius: '10px',
              fontSize: '0.875rem',
            },
          }}
          richColors
          closeButton
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
