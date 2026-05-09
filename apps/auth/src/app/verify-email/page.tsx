import { Suspense } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import VerifyEmailPage from '@/features/auth/components/VerifyEmailPage/VerifyEmailPage';

export const metadata: Metadata = {
  title: 'Verify Email — Apio',
  description: 'Verify your Apio account email address.',
  robots: { index: false, follow: false },
};

// Extract token from search params server-side so the page is SSR-safe.
// The actual verification fetch runs client-side in the component.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  // Warm the headers (needed for Next 15 dynamic rendering)
  await headers();
  const { token } = await searchParams;

  return (
    <Suspense>
      <VerifyEmailPage token={token ?? null} />
    </Suspense>
  );
}
