import { Suspense } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import VerifyPendingPage from '@/features/auth/components/VerifyPendingPage/VerifyPendingPage';

export const metadata: Metadata = {
  title: 'Creating Account — Apio',
  description: 'Finalizing your Apio account creation.',
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  await headers();
  const { token, email } = await searchParams;

  return (
    <Suspense>
      <VerifyPendingPage token={token ?? null} email={email ?? null} />
    </Suspense>
  );
}
