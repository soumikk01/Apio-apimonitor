'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Props {
  token: string | null;
  email: string | null;
}

type Status = 'verifying' | 'success' | 'error' | 'expired';

export default function VerifyPendingPage({ token, email }: Props) {
  // Derive the initial state synchronously — avoids calling setState inside an
  // effect body (react-hooks/set-state-in-effect lint error).
  const isInvalidLink = !token || !email;
  const [status, setStatus] = useState<Status>(isInvalidLink ? 'error' : 'verifying');
  const [message, setMessage] = useState<string>(
    isInvalidLink ? 'Invalid verification link. Please register again.' : '',
  );

  useEffect(() => {
    // Nothing to fetch — initial state already reflects the error.
    if (!token || !email) return;

    const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    const url = `${API}/auth/verify-pending?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    // AbortController so we can cancel the request if the component unmounts
    // before the response arrives (prevents setState on an unmounted component).
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({ message: '' })) as { message?: string; success?: boolean };
        if (res.ok) {
          setStatus('success');
          setTimeout(() => {
            window.location.href = '/login?registered=true';
          }, 2000);
        } else if (res.status === 404) {
          setStatus('expired');
          setMessage(body.message ?? 'Verification link expired. Please register again.');
        } else {
          setStatus('error');
          setMessage(body.message ?? 'Verification failed. Please try again.');
        }
      })
      .catch((err: unknown) => {
        // AbortError is expected on unmount — swallow it silently.
        if ((err as Error).name === 'AbortError') return;
        setStatus('error');
        setMessage('Network error. Please try again.');
      });

    // Cleanup: cancel in-flight request when component unmounts or deps change.
    return () => controller.abort();
  }, [token, email]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'sans-serif',
      padding: '2rem',
      textAlign: 'center',
    }}>
      {status === 'verifying' && (
        <>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Creating your account…</h1>
          <p style={{ color: '#888' }}>Please wait while we set up your Apio account.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✅</div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Account created!</h1>
          <p style={{ color: '#888' }}>Your account has been verified and created. Redirecting to login…</p>
        </>
      )}

      {status === 'expired' && (
        <>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⌛</div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Link expired</h1>
          <p style={{ color: '#888', marginBottom: '1.5rem' }}>{message}</p>
          <Link
            href="/register"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              background: '#fff',
              color: '#000',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Register again
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>❌</div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Verification failed</h1>
          <p style={{ color: '#888', marginBottom: '1.5rem' }}>{message}</p>
          <Link
            href="/register"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              background: '#fff',
              color: '#000',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Try again
          </Link>
        </>
      )}
    </div>
  );
}
