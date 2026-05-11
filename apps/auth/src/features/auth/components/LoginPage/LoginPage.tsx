'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';
import ButtonLogoSpinner from '@/components/ButtonLogoSpinner/ButtonLogoSpinner';
import GooeyButton from '@/components/GooeyButton/GooeyButton';
import GooeyErrorFilter from '@/components/GooeyErrorFilter/GooeyErrorFilter';
import AnimatedPasswordInput from '../../../../components/AnimatedPasswordInput/AnimatedPasswordInput';
import { ApioTypeWriter } from '@/components/ApioTypeWriter/ApioTypeWriter';
import styles from './LoginPage.module.scss';

/* ── Sparkle Background (mirrors LandingPage stars) ── */
const SpringBackground = () => (
  <div className={styles.springBg} aria-hidden="true">
    {/* Sparkle stars */}
    <svg className={`${styles.sparkle} ${styles.sp1}`} viewBox="0 0 20 20" fill="none"><path d="M10,1 L11.2,8.8 L19,10 L11.2,11.2 L10,19 L8.8,11.2 L1,10 L8.8,8.8 Z" fill="#1A1A1A" opacity="0.65"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp2}`} viewBox="0 0 14 14" fill="none"><path d="M7,1 L7.8,6.2 L13,7 L7.8,7.8 L7,13 L6.2,7.8 L1,7 L6.2,6.2 Z" fill="#1A1A1A" opacity="0.5"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp3}`} viewBox="0 0 18 18" fill="none"><path d="M9,1.5 L10,7.8 L16.5,9 L10,10.2 L9,16.5 L8,10.2 L1.5,9 L8,7.8 Z" fill="#7C6050" opacity="0.4"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp4}`} viewBox="0 0 10 10" fill="none"><path d="M5,0.5 L5.6,4.4 L9.5,5 L5.6,5.6 L5,9.5 L4.4,5.6 L0.5,5 L4.4,4.4 Z" fill="#1A1A1A" opacity="0.45"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp5}`} viewBox="0 0 16 16" fill="none"><path d="M8,1 L9,6.8 L15,8 L9,9.2 L8,15 L7,9.2 L1,8 L7,6.8 Z" fill="#1A1A1A" opacity="0.55"/></svg>
  </div>
);

export default function LoginPage() {
  // dark mode is always on — no toggle needed

  const { login, loginWithGoogle, loginWithGitHub } = useAuth();

  const searchParams = useSearchParams();
  const isVerified = searchParams.get('verified') === 'true';
  const verifiedEmail = searchParams.get('email') ?? '';

  // ── Hydration-safe: always start empty on server, populate after mount ──
  const [email, setEmail] = useState('');
  const [lastUsedEmail, setLastUsedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // If coming from email verification, pre-fill the verified email
    if (verifiedEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(verifiedEmail);
      return;
    }
    const saved = localStorage.getItem('apio_last_email') ?? '';
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(saved);
      setLastUsedEmail(saved);
    }
  }, [verifiedEmail]);


  const handleInvalid = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsShaking(false);

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      handleInvalid();
      return;
    }

    setIsSubmitting(true);
    try {
      localStorage.setItem('apio_last_email', email.trim());
      await login(email, password);
      // redirect handled inside useAuth.login()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';

      // ── Legacy account auto-verify retry ──────────────────────────────────
      // BetterAuth returns EMAIL_NOT_VERIFIED for users created before
      // mandatory email verification was enforced. The backend's before-hook
      // auto-flips emailVerified=true for credential accounts. Retry once
      // so the user lands on /2fa (if enabled) or the dashboard — not check-email.
      if (msg === '__EMAIL_NOT_VERIFIED__') {
        try {
          await login(email, password); // retry — now emailVerified:true in DB
          return; // login() handles redirect
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : '';
          // If still EMAIL_NOT_VERIFIED after retry → genuine unverified new account
          if (retryMsg === '__EMAIL_NOT_VERIFIED__') {
            window.location.href = `/check-email?email=${encodeURIComponent(email.trim())}`;
            return;
          }
          setError(retryMsg || 'Sign in failed. Please try again.');
          setIsSubmitting(false);
          handleInvalid();
          return;
        }
      }

      setError(msg);
      setIsSubmitting(false);
      handleInvalid();
    }
  };

  return (
    <div className={`${styles.page} ${styles.dark}`}>
      <GooeyErrorFilter isError={isShaking} />
      <div className={styles.splitLayout}>

        {/* ── SPLIT BACK BUTTON ── */}
        <a
          href={process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}
          className={styles.splitBackBtn}
          aria-label="Back to Home"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </a>

        <div className={styles.leftPane}>
          <div className={styles.noiseOverlay} />
          <SpringBackground />

      {/* ── MAIN ── */}
      <main className={styles.main}>
        <style dangerouslySetInnerHTML={{__html: `
            .apio-autofill-transparent:-webkit-autofill,
            .apio-autofill-transparent:-webkit-autofill:hover, 
            .apio-autofill-transparent:-webkit-autofill:focus, 
            .apio-autofill-transparent:-webkit-autofill:active {
                transition: background-color 5000s ease-in-out 0s, color 5000s ease-in-out 0s !important;
            }
        `}} />
        {isVerified && (
            <div role="alert" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              borderRadius: '10px',
              color: '#4ade80',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}>
              <span style={{ fontSize: '1.1rem' }}>✅</span>
              <span>Account verified! Sign in to continue to Apio.</span>
            </div>
          )}
        <div className={styles.card}>
          <form className={styles.form} onSubmit={handleLogin} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-email">
                Email
                {lastUsedEmail && email === lastUsedEmail && (
                  <span className={styles.lastUsedTag}>Last used</span>
                )}
              </label>
              <div className={`${styles.input} ${styles.inputWrapper} ${isShaking ? styles.inputError : ''}`}>
                <input
                  id="login-email"
                  className="apio-autofill-transparent"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: 0, margin: 0, color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit' }}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-password">Password</label>
              <AnimatedPasswordInput
                id="login-password"
                wrapperClassName={`${styles.input} ${styles.passwordWrapper} ${isShaking ? styles.inputError : ''}`}
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <div style={{ textAlign: 'right', marginTop: '2px' }}>
                <Link href="/forgot-password" className={styles.forgotLinkInline}>Forgot password?</Link>
              </div>
            </div>

            {error && (
              <div role="alert" aria-live="polite" className={styles.errorBanner}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

                <GooeyButton 
                  type="submit" 
                  className={styles.submitBtn} 
                  isLoading={isSubmitting}
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  }
                >
                  {isSubmitting ? (
                    <span className={styles.loaderContent}>
                      <ButtonLogoSpinner />
                      Authenticating...
                    </span>
                  ) : 'Sign In'}
                </GooeyButton>
          </form>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>or continue with</span>
            <span className={styles.dividerLine} />
          </div>

          <div className={styles.oauthRow}>
            <GooeyButton
              type="button"
              className={styles.oauthBtn}
              wrapperClassName={styles.oauthBtnWrapper}
              aria-label="Sign in with Google"
              onClick={loginWithGoogle}
              disableGooeyFilter
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </GooeyButton>
            
            <GooeyButton
              type="button"
              className={styles.oauthBtn}
              wrapperClassName={styles.oauthBtnWrapper}
              aria-label="Sign in with GitHub"
              onClick={loginWithGitHub}
              disableGooeyFilter
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
              GitHub
            </GooeyButton>
          </div>

          </div>
        </main>
      </div>

      {/* ── RIGHT VIEW ── */}
      <div className={styles.rightPane}>
        <div className={styles.patternOverlay} />

        {/* ── STRIPE-STYLE TYPEWRITER ── */}
        <ApioTypeWriter />

        {/* ── CENTER COPY ── */}
        <div className={styles.rightCopy}>
          <div className={styles.introIcon}>
            <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className={styles.introTitle}>Welcome back</h1>
          <p className={styles.introSub}>Sign in to your Apio account</p>
        </div>

        {/* ── NAVBAR ── */}
        <header className={styles.navWrap}>
          <nav className={styles.nav}>
            <div className={styles.logo}>
              <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" stroke="#1A1A1A" strokeWidth="1.5" fill="none"/>
                <circle cx="10" cy="10" r="3" fill="#1A1A1A"/>
              </svg>
              <span className={styles.logoMark}>Apio</span>
            </div>
          </nav>
        </header>

        {/* ── BOTTOM LINKS ── */}
        <div className={styles.rightUtilLinks}>
          <span className={styles.rightForgotLink}>New to Apio?</span>
          <Link href="/register" className={styles.rightRegisterLink}>
            Create account →
          </Link>
        </div>

      </div>
    </div>
  </div>
  );
}
