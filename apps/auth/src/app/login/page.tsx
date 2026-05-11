import { Suspense } from 'react';
import LoginPage from '@/features/auth/components/LoginPage/LoginPage';

export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
