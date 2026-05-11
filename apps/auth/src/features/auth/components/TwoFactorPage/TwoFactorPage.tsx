'use client';

import { useState, useEffect, useRef } from 'react';
import { authClient } from '@/lib/auth-client';
import GooeyButton from '@/components/GooeyButton/GooeyButton';
import GooeyErrorFilter from '@/components/GooeyErrorFilter/GooeyErrorFilter';
import ButtonLogoSpinner from '@/components/ButtonLogoSpinner/ButtonLogoSpinner';
import styles from './TwoFactorPage.module.scss';
import loginStyles from '../LoginPage/LoginPage.module.scss';

const SpringBackground = () => (
  <div className={loginStyles.springBg} aria-hidden="true">
    <svg className={`${loginStyles.sparkle} ${loginStyles.sp1}`} viewBox="0 0 20 20" fill="none"><path d="M10,1 L11.2,8.8 L19,10 L11.2,11.2 L10,19 L8.8,11.2 L1,10 L8.8,8.8 Z" fill="#1A1A1A" opacity="0.65"/></svg>
    <svg className={`${loginStyles.sparkle} ${loginStyles.sp2}`} viewBox="0 0 14 14" fill="none"><path d="M7,1 L7.8,6.2 L13,7 L7.8,7.8 L7,13 L6.2,7.8 L1,7 L6.2,6.2 Z" fill="#1A1A1A" opacity="0.5"/></svg>
    <svg className={`${loginStyles.sparkle} ${loginStyles.sp3}`} viewBox="0 0 18 18" fill="none"><path d="M9,1.5 L10,7.8 L16.5,9 L10,10.2 L9,16.5 L8,10.2 L1.5,9 L8,7.8 Z" fill="#7C6050" opacity="0.4"/></svg>
    <svg className={`${loginStyles.sparkle} ${loginStyles.sp4}`} viewBox="0 0 10 10" fill="none"><path d="M5,0.5 L5.6,4.4 L9.5,5 L5.6,5.6 L5,9.5 L4.4,5.6 L0.5,5 L4.4,4.4 Z" fill="#1A1A1A" opacity="0.45"/></svg>
    <svg className={`${loginStyles.sparkle} ${loginStyles.sp5}`} viewBox="0 0 16 16" fill="none"><path d="M8,1 L9,6.8 L15,8 L9,9.2 L8,15 L7,9.2 L1,8 L7,6.8 Z" fill="#1A1A1A" opacity="0.55"/></svg>
  </div>
);

// ── Extracted outside component to avoid 'cannot create during render' error ──
function ErrorBanner({ errorMsg }: { errorMsg: string }) {
  if (!errorMsg) return null;
  return (
    <div className={loginStyles.errorBanner}>
      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0, marginTop: 2 }}>
        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
      </svg>
      {errorMsg}
    </div>
  );
}


export default function TwoFactorPage() {
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first box on mount
  useEffect(() => {
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  }, []);

  const shake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  };

  const redirectToDashboard = () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    window.location.assign(`${appUrl}/projects`);
  };


  // ── Submit TOTP (only method) ────────────────────────────────────────────
  const handleTotpSubmit = async (submittedCode?: string) => {
    const clean = (submittedCode ?? code).replace(/\s/g, '');
    if (clean.length !== 6) { setErrorMsg('Please enter the full 6-digit code.'); shake(); return; }

    setIsSubmitting(true); setErrorMsg('');
    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code: clean });
      if (error) throw new Error(error.message ?? 'Invalid code. Please try again.');
      redirectToDashboard();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed.');
      shake();
    } finally { setIsSubmitting(false); }
  };

  // ── 6-box OTP renderer ───────────────────────────────────────────────────
  const renderOtpBoxes = () => (
    <div className={`${styles.otpRow} ${isShaking ? styles.shake : ''}`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { otpRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={1}
          autoComplete="one-time-code"
          className={`${styles.otpCell} ${code[i] ? styles.otpCellFilled : ''} ${errorMsg && !code[i] ? styles.otpCellError : ''}`}
          value={code[i] ?? ''}
          placeholder="·"
          disabled={isSubmitting}
          onChange={e => {
            const digit = e.target.value.replace(/\D/g, '').slice(-1);
            const next = code.split('');
            next[i] = digit;
            const joined = next.join('').substring(0, 6);
            setCode(joined);
            setErrorMsg('');
            if (digit && i < 5) otpRefs.current[i + 1]?.focus();
            if (joined.length === 6) setTimeout(() => void handleTotpSubmit(joined), 80);
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (code[i]) {
                setCode(code.substring(0, i) + code.substring(i + 1));
              } else if (i > 0) {
                otpRefs.current[i - 1]?.focus();
                setCode(code.substring(0, i - 1) + code.substring(i));
              }
              setErrorMsg('');
            } else if (e.key === 'ArrowLeft' && i > 0) {
              e.preventDefault(); otpRefs.current[i - 1]?.focus();
            } else if (e.key === 'ArrowRight' && i < 5) {
              e.preventDefault(); otpRefs.current[i + 1]?.focus();
            } else if (e.key === 'Enter') {
              e.preventDefault(); void handleTotpSubmit();
            }
          }}
          onPaste={e => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').substring(0, 6);
            setCode(pasted);
            setErrorMsg('');
            const nextIdx = Math.min(pasted.length, 5);
            otpRefs.current[nextIdx]?.focus();
            if (pasted.length === 6) setTimeout(() => void handleTotpSubmit(pasted), 80);
          }}
          onFocus={e => e.target.select()}
        />
      ))}
    </div>
  );

  // Subtitle
  const subtitle = 'Enter the 6-digit code from your authenticator app.';

  return (
    <div className={`${loginStyles.page} ${loginStyles.dark}`}>
      <GooeyErrorFilter isError={isShaking} />
      <div className={loginStyles.noiseOverlay} />

      <div className={loginStyles.splitLayout}>
        {/* ── LEFT PANE ── */}
        <div className={loginStyles.leftPane}>
          <SpringBackground />
          
          <main className={loginStyles.main}>
            <div className={loginStyles.card}>
              <div className={loginStyles.cardHeader}>
                <div className={loginStyles.cardIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h1 className={loginStyles.cardTitle}>Two-Factor Verification</h1>
                <div className={styles.methodBadge}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                    <rect x="5" y="2" width="14" height="20" rx="2"/>
                    <path d="M12 18h.01" strokeLinecap="round" strokeWidth="2.5"/>
                  </svg>
                  Authenticator App
                </div>
                <p className={loginStyles.cardSub} style={{ marginTop: '0.5rem' }}>{subtitle}</p>
              </div>

              {/* TOTP form — only method */}
              <form style={{ width: '100%' }} onSubmit={e => { e.preventDefault(); void handleTotpSubmit(); }} noValidate>
                {renderOtpBoxes()}
                <ErrorBanner errorMsg={errorMsg} />
                  <GooeyButton
                    type="submit"
                    className={`${loginStyles.submitBtn} ${styles.submitBtn}`}
                    disabled={isSubmitting || code.length !== 6}
                    isLoading={isSubmitting}
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                    }
                  >
                    {isSubmitting ? (
                      <span className={loginStyles.loaderContent}>
                        <ButtonLogoSpinner />
                        Verifying…
                      </span>
                    ) : 'Verify & Sign In'}
                  </GooeyButton>
              </form>

              {/* Back to login */}
              <div className={styles.footer} style={{ borderTop: 'none', marginTop: '1rem', paddingTop: '0.5rem' }}>
                <a href="/login" className={loginStyles.forgotLinkInline}>← Back to login</a>
              </div>
            </div>
          </main>
        </div>

        {/* ── RIGHT PANE ── */}
        <div className={loginStyles.rightPane}>
          <div className={loginStyles.patternOverlay} />
          
          <div className={loginStyles.rightCopy}>
            <div className={loginStyles.introIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className={loginStyles.introTitle}>Secure Access</h1>
            <p className={loginStyles.introSub}>Enter your verification code to complete sign in and access your Apio projects.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
