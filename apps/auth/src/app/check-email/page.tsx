'use client';

import React, { Suspense, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import GooeyButton from '@/components/GooeyButton/GooeyButton';
import SpringBackground from '@/components/SpringBackground/SpringBackground';
import fp from '@/features/auth/components/ForgotPasswordPage/ForgotPasswordPage.module.scss';

const TOTAL_SECONDS = 300; // 5 minutes
const HEX_POINTS   = '70,18 113,44 113,96 70,122 27,96 27,44';

// ── Fade Digit — appear/disappear animation when the digit changes ────────────────
function FadeDigit({ value, color }: { value: string; color: string }) {
  const [current,   setCurrent]   = useState(value);
  const [prev,      setPrev]      = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (value === current) return;
    setPrev(current);
    setAnimating(true);
    setCurrent(value);
    const t = setTimeout(() => { setPrev(null); setAnimating(false); }, 400);
    return () => clearTimeout(t);
  }, [value, current]);

  const digitStyle: React.CSSProperties = {
    fontSize: '3.5rem',
    fontWeight: 800,
    lineHeight: 1,
    fontFamily: "'Inter', -apple-system, sans-serif",
    color,
    letterSpacing: '1px',
    textShadow: `0 0 24px rgba(255, 255, 255, 0.4)`,
    transition: 'color 1s linear',
  };

  return (
    <>
      {/* Inlined keyframes — only added once per page render */}
      <style>{`
        @keyframes ceDigitFadeOut {
          0%   { transform: scale(1); opacity: 1; filter: blur(0px); }
          100% { transform: scale(0.85); opacity: 0; filter: blur(4px); }
        }
        @keyframes ceDigitFadeIn {
          0%   { transform: scale(1.15); opacity: 0; filter: blur(4px); }
          100% { transform: scale(1); opacity: 1; filter: blur(0px); }
        }
      `}</style>

      <div style={{
        position: 'relative',
        width: '2.5rem',
        height: '4rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Old digit — shrinks and fades out */}
        {prev !== null && (
          <span style={{
            ...digitStyle,
            position: 'absolute',
            animation: 'ceDigitFadeOut 0.4s cubic-bezier(0.4, 0, 1, 1) forwards',
          }}>
            {prev}
          </span>
        )}

        {/* New digit — expands and fades in */}
        <span style={{
          ...digitStyle,
          position: 'absolute',
          animation: animating
            ? 'ceDigitFadeIn 0.4s cubic-bezier(0, 0, 0.2, 1) forwards'
            : 'none',
        }}>
          {current}
        </span>
      </div>
    </>
  );
}

// ── Countdown Timer — classic styling + fade digits ───────────────────────────────
function CountdownTimer({ seconds }: { seconds: number }) {
  const color = '#F3F4F6'; // Classic white/gray

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  return (
    <div style={{ position: 'relative', margin: '1rem auto 2.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <FadeDigit value={mins[0]} color={color} />
      <FadeDigit value={mins[1]} color={color} />
      <span style={{
        fontSize: '3rem',
        fontWeight: 800,
        color: 'rgba(255, 255, 255, 0.5)',
        lineHeight: 1,
        paddingBottom: '8px',
        margin: '0 4px',
        animation: 'ceColonBlink 1s step-end infinite',
      }}>:</span>
      <FadeDigit value={secs[0]} color={color} />
      <FadeDigit value={secs[1]} color={color} />

      <style>{`
        @keyframes ceColonBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}


// ── Expired Hexagon with animated red X ───────────────────────────────────────
function ExpiredHex() {
  return (
    <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 1.5rem' }}>
      {/* Pulse rings */}
      {[0, 0.4, 0.8].map((delay, i) => (
        <div key={i} style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '2px solid #ef4444',
          animation: `pulseRingRed 1.4s ${delay}s ease-out forwards`,
        }} />
      ))}
      <svg viewBox="0 0 140 140" fill="none" width="120" height="120"
        style={{ filter: 'drop-shadow(0 0 14px rgba(239,68,68,0.65))' }}>
        <polygon points={HEX_POINTS} fill="rgba(239,68,68,0.1)" />
        <polygon points={HEX_POINTS}
          fill="none" stroke="#ef4444" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="340" strokeDashoffset="0"
          style={{ animation: 'hexDraw 1.2s cubic-bezier(0.4,0,0.2,1) forwards' }}
        />
        <line x1="52" y1="52" x2="88" y2="88"
          stroke="#ef4444" strokeWidth="5" strokeLinecap="round"
          strokeDasharray="60" strokeDashoffset="60"
          style={{ animation: 'checkDraw 0.45s 0.6s ease forwards' }}
        />
        <line x1="88" y1="52" x2="52" y2="88"
          stroke="#ef4444" strokeWidth="5" strokeLinecap="round"
          strokeDasharray="60" strokeDashoffset="60"
          style={{ animation: 'checkDraw 0.45s 0.75s ease forwards' }}
        />
      </svg>
      <style>{`
        @keyframes pulseRingRed {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        @keyframes hexDraw {
          from { stroke-dashoffset: 340; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes checkDraw {
          from { stroke-dashoffset: 60; opacity: 0; }
          30%  { opacity: 1; }
          to   { stroke-dashoffset: 0; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function CheckEmailContent() {
  const params   = useSearchParams();
  const email    = params.get('email') ?? '';
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [expired,  setExpired]  = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── EXPIRED STATE ──────────────────────────────────────────────────────────
  if (expired) {
    return (
      <div className={`${fp.page} ${fp.dark}`}>
        <div className={fp.patternOverlay} />
        <div className={fp.noiseOverlay} />
        <SpringBackground />

        <main className={fp.centerMain}>
          <div className={fp.centerStack}>
            <div className={fp.topCopy}>
              <ExpiredHex />
              <h1 className={fp.introTitle} style={{ color: '#fff' }}>Timer Ended</h1>
              <p className={fp.introSub}>
                Your 5-minute reminder has passed, but your verification
                link is still valid for <strong>24 hours</strong>.
                <br />
                Check your inbox (and spam) or register again.
              </p>
            </div>

            <div className={fp.card} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem', lineHeight: 1.7 }}>
                Didn&apos;t receive the email? Check your spam folder or
                request a new verification link.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column', alignItems: 'center' }}>
                <GooeyButton onClick={() => { window.location.href = '/register'; }}>
                  Register Again
                </GooeyButton>
                <Link href="/login" style={{ color: '#818cf8', fontSize: '0.83rem' }}>Back to Login</Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── WAITING STATE ──────────────────────────────────────────────────────────
  return (
    <div className={`${fp.page} ${fp.dark}`}>
      <div className={fp.patternOverlay} />
      <div className={fp.noiseOverlay} />
      <SpringBackground />

      <main className={fp.centerMain}>
        <div className={fp.centerStack}>

          {/* Envelope icon + title */}
          <div className={fp.topCopy}>
            <div className={fp.introIcon} style={{ width: 64, height: 64 }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                stroke="rgba(168,216,255,0.85)" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="3"/>
                <path d="M2 7l10 7 10-7"/>
              </svg>
            </div>
            <h1 className={fp.introTitle}>Check your inbox</h1>
            <p className={fp.introSub}>
              We sent a verification link to{' '}
              {email
                ? <strong style={{ color: '#fff' }}>{email}</strong>
                : 'your email address'
              }
            </p>
          </div>

          {/* Card with clock + instructions + button */}
          <div className={fp.card} style={{ textAlign: 'center' }}>

            {/* ── Flip-digit countdown timer ── */}
            <CountdownTimer seconds={timeLeft} />

            {/* Instructions */}
            <p style={{
              fontSize: '0.83rem',
              color: 'rgba(255,255,255,0.42)',
              marginTop: '2.2rem',
              marginBottom: '1.4rem',
              lineHeight: 1.7,
            }}>
              Click the link in the email to activate your account.
              <br />
              Didn&apos;t receive it? Check spam or{' '}
              <Link href="/register"
                style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}>
                try a different email
              </Link>.
            </p>

            {/* Back to Login */}
            <GooeyButton onClick={() => { window.location.href = '/login'; }}>
              Back to Login
            </GooeyButton>

          </div>
        </div>
      </main>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailContent />
    </Suspense>
  );
}
