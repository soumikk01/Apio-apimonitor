'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import GooeyButton from '@/components/GooeyButton/GooeyButton';
import SpringBackground from '@/components/SpringBackground/SpringBackground';
import fp from '@/features/auth/components/ForgotPasswordPage/ForgotPasswordPage.module.scss';

const BACKEND      = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const REDIRECT_S   = 4;
const HEX          = '70,18 113,44 113,96 70,122 27,96 27,44';
const HEX_PERIM    = 340; // approximate polygon perimeter for dash animation

type Status = 'verifying' | 'success' | 'error' | 'no-token';


// ── HexLogo — large prominent hexagon that morphs ─────────────────────────────
function HexLogo({ status }: { status: Status }) {
  const isVerifying = status === 'verifying';
  const isSuccess   = status === 'success';
  const isError     = status === 'error' || status === 'no-token';

  const hexColor  = isSuccess ? '#22c55e' : isError ? '#ef4444' : '#6366f1';
  const glowColor = isSuccess
    ? 'rgba(34,197,94,0.5)'
    : isError
    ? 'rgba(239,68,68,0.5)'
    : 'rgba(99,102,241,0.4)';

  return (
    <div style={{ position: 'relative', width: 150, height: 150, margin: '0 auto 2rem' }}>
      {/* Success pulse rings */}
      {isSuccess && [0, 0.35, 0.7].map((delay, i) => (
        <div key={i} style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `2px solid #22c55e`,
          animation: `veHexPulse 1.4s ${delay}s ease-out forwards`,
        }} />
      ))}

      {/* Orbit ring during verifying */}
      {isVerifying && (
        <div style={{
          position: 'absolute',
          inset: -10,
          borderRadius: '50%',
          border: '1.5px dashed rgba(99,102,241,0.35)',
          animation: 'veOrbit 5s linear infinite',
        }} />
      )}

      <svg viewBox="0 0 140 140" fill="none" width="150" height="150"
        style={{ filter: `drop-shadow(0 0 18px ${glowColor})`, transition: 'filter 0.6s ease' }}>

        {/* Hex fill */}
        <polygon points={HEX}
          fill={isSuccess
            ? 'rgba(34,197,94,0.12)'
            : isError
            ? 'rgba(239,68,68,0.1)'
            : 'rgba(99,102,241,0.1)'}
          style={{ transition: 'fill 0.5s ease' }}
        />

        {/* Hex border — draws itself */}
        <polygon points={HEX}
          fill="none"
          stroke={hexColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={HEX_PERIM}
          strokeDashoffset={HEX_PERIM}
          style={{
            animation: 'veHexDraw 1.2s cubic-bezier(0.4,0,0.2,1) forwards',
            transition: 'stroke 0.5s ease',
          }}
        />

        {/* Spinning arc — only during verifying */}
        {isVerifying && (
          <circle cx="70" cy="70" r="38"
            fill="none" stroke="#6366f1" strokeWidth="2.5"
            strokeLinecap="round" strokeDasharray="60 180"
            style={{ transformOrigin: 'center', animation: 'veOrbit 1s linear infinite' }}
          />
        )}

        {/* APIO text — during verifying */}
        {isVerifying && (
          <text x="70" y="76" textAnchor="middle" dominantBaseline="middle"
            fill="rgba(255,255,255,0.85)"
            style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2,
              animation: 'veFadeIn 0.8s 1s ease forwards', opacity: 0 }}>
            APIO
          </text>
        )}

        {/* GREEN checkmark — on success */}
        {isSuccess && (
          <polyline points="44,70 62,88 96,54"
            fill="none" stroke="#22c55e" strokeWidth="6"
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="90" strokeDashoffset="90"
            style={{ animation: 'veCheckDraw 0.65s 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
          />
        )}

        {/* RED X — on error */}
        {isError && (
          <>
            <line x1="50" y1="50" x2="90" y2="90"
              stroke="#ef4444" strokeWidth="6" strokeLinecap="round"
              strokeDasharray="60" strokeDashoffset="60"
              style={{ animation: 'veCheckDraw 0.4s 0.4s ease forwards' }}
            />
            <line x1="90" y1="50" x2="50" y2="90"
              stroke="#ef4444" strokeWidth="6" strokeLinecap="round"
              strokeDasharray="60" strokeDashoffset="60"
              style={{ animation: 'veCheckDraw 0.4s 0.55s ease forwards' }}
            />
          </>
        )}
      </svg>

      {/* Global keyframes (inlined per-page to avoid SCSS conflicts) */}
      <style>{`
        @keyframes veHexDraw {
          from { stroke-dashoffset: ${HEX_PERIM}; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes veCheckDraw {
          from { stroke-dashoffset: 90; opacity: 0; }
          30%  { opacity: 1; }
          to   { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes veOrbit {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes veHexPulse {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes veFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes veSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes veCountdown {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props { token: string | null; }

export default function VerifyEmailPage({ token }: Props) {
  const [status,    setStatus]    = useState<Status>(token ? 'verifying' : 'no-token');
  const [errorMsg,  setErrorMsg]  = useState('');
  const [countdown, setCountdown] = useState(REDIRECT_S);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Verify the token against backend
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(
          `${BACKEND}/auth/better/verify-email?token=${encodeURIComponent(token)}`,
          { method: 'GET', credentials: 'include' },
        );
        if (res.ok) {
          setStatus('success');
        } else {
          const data = await res.json().catch(() => ({})) as { message?: string };
          setErrorMsg(data.message ?? 'Verification failed. The link may have expired.');
          setStatus('error');
        }
      } catch {
        setErrorMsg('Network error. Please try again.');
        setStatus('error');
      }
    })();
  }, [token]);

  // Auto-redirect countdown on success
  useEffect(() => {
    if (status !== 'success') return;
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          window.location.href = '/login';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [status]);

  const copy: Record<Status, { title: string; sub: string }> = {
    verifying:  { title: 'Verifying…',          sub: 'Confirming your email address, please wait.' },
    success:    { title: 'Email Verified!',      sub: 'Your Apio account is now active and ready.' },
    error:      { title: 'Verification Failed',  sub: errorMsg || 'This link is invalid or has expired.' },
    'no-token': { title: 'Invalid Link',         sub: 'This link is invalid or has already been used.' },
  };

  return (
    <div className={`${fp.page} ${fp.dark}`}>
      <div className={fp.patternOverlay} />
      <div className={fp.noiseOverlay} />
      <SpringBackground />

      {/* Pill navbar */}
      <div className={fp.navWrap}>
        <nav className={fp.nav}>
          <div className={fp.logo}>
            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
              <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" stroke="#1A1A1A" strokeWidth="1.5" fill="none"/>
              <circle cx="10" cy="10" r="3" fill="#1A1A1A"/>
            </svg>
            <span className={fp.logoMark}>Apio</span>
          </div>
          <Link href="/login" className={fp.backLink}>← Login</Link>
        </nav>
      </div>

      <main className={fp.centerMain}>
        <div className={fp.centerStack}>

          {/* Big hexagon logo animation */}
          <div className={fp.topCopy}>
            <HexLogo status={status} />
            <h1 className={fp.introTitle}
              style={{ animation: 'veSlideUp 0.5s 0.3s ease both' }}>
              {copy[status].title}
            </h1>
            <p className={fp.introSub}
              style={{ animation: 'veSlideUp 0.5s 0.45s ease both' }}>
              {copy[status].sub}
            </p>
          </div>

          {/* Card — countdown + CTA */}
          <div className={fp.card} style={{ textAlign: 'center' }}>

            {/* Countdown bar on success */}
            {status === 'success' && (
              <div style={{ marginBottom: '1.5rem',
                animation: 'veSlideUp 0.5s 0.6s ease both' }}>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
                  Redirecting in <strong style={{ color: '#22c55e' }}>{countdown}s</strong>
                </p>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.09)',
                  borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: '#22c55e', borderRadius: 99,
                    animation: `veCountdown ${REDIRECT_S}s linear forwards`,
                  }} />
                </div>
              </div>
            )}

            {status === 'success' && (
              <div style={{ animation: 'veSlideUp 0.5s 0.7s ease both' }}>
                <GooeyButton onClick={() => { window.location.href = '/login'; }}>
                  Sign in now →
                </GooeyButton>
              </div>
            )}

            {(status === 'error' || status === 'no-token') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem',
                animation: 'veSlideUp 0.5s 0.6s ease both' }}>
                <GooeyButton onClick={() => { window.location.href = '/register'; }}>
                  Register again
                </GooeyButton>
                <button
                  onClick={() => { window.location.href = '/login'; }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.4)', fontSize: '0.83rem',
                    textDecoration: 'underline', fontFamily: 'Inter, sans-serif',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                >
                  Back to Login
                </button>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
