'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';
import ButtonLogoSpinner from '../../../../components/ButtonLogoSpinner/ButtonLogoSpinner';
import GooeyButton from '../../../../components/GooeyButton/GooeyButton';
import GooeyErrorFilter from '../../../../components/GooeyErrorFilter/GooeyErrorFilter';
import AnimatedPasswordInput from '../../../../components/AnimatedPasswordInput/AnimatedPasswordInput';
import PasswordStrengthPanel from '../../../../components/PasswordStrengthPanel/PasswordStrengthPanel';
import { ApioTypeWriter } from '@/components/ApioTypeWriter/ApioTypeWriter';
import styles from './RegisterPage.module.scss';

/* ── Per-email rate limit (localStorage) ─────────────────────────────────────
 * Key: `apio_reg_${email}`  Value: JSON { fails: number, blockedUntil?: number, permanent?: boolean }
 * 3 fails  → blocked 30 minutes
 * 15 fails → permanently blocked (that email only)
 */
const RL_KEY = (email: string) => `apio_reg_${email.toLowerCase().trim()}`;

interface RLRecord { fails?: number; blockedUntil?: number; permanent?: boolean }

function getRl(email: string): RLRecord {
  try { return JSON.parse(localStorage.getItem(RL_KEY(email)) ?? '{}') as RLRecord; }
  catch { return { fails: 0 }; }
}
function setRl(email: string, rec: RLRecord) {
  try { localStorage.setItem(RL_KEY(email), JSON.stringify(rec)); } catch { /* ignore */ }
}
function recordFail(email: string): { blocked: boolean; permanent: boolean; minutesLeft: number } {
  const rec = getRl(email);
  const fails = (rec.fails ?? 0) + 1;
  if (fails >= 15) {
    setRl(email, { fails, permanent: true });
    return { blocked: true, permanent: true, minutesLeft: 0 };
  }
  if (fails >= 3) {
    const blockedUntil = Date.now() + 30 * 60 * 1000;
    setRl(email, { fails, blockedUntil });
    return { blocked: true, permanent: false, minutesLeft: 30 };
  }
  setRl(email, { fails });
  return { blocked: false, permanent: false, minutesLeft: 0 };
}
function checkBlock(email: string): { blocked: boolean; permanent: boolean; minutesLeft: number } {
  const rec = getRl(email);
  if (rec.permanent) return { blocked: true, permanent: true, minutesLeft: 0 };
  if (rec.blockedUntil && Date.now() < rec.blockedUntil) {
    return { blocked: true, permanent: false, minutesLeft: Math.ceil((rec.blockedUntil - Date.now()) / 60000) };
  }
  return { blocked: false, permanent: false, minutesLeft: 0 };
}

const SpringBackground = () => (
  <div className={styles.springBg} aria-hidden="true">
    <svg className={`${styles.sparkle} ${styles.sp1}`} viewBox="0 0 20 20" fill="none"><path d="M10,1 L11.2,8.8 L19,10 L11.2,11.2 L10,19 L8.8,11.2 L1,10 L8.8,8.8 Z" fill="#1A1A1A" opacity="0.65"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp2}`} viewBox="0 0 14 14" fill="none"><path d="M7,1 L7.8,6.2 L13,7 L7.8,7.8 L7,13 L6.2,7.8 L1,7 L6.2,6.2 Z" fill="#1A1A1A" opacity="0.5"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp3}`} viewBox="0 0 18 18" fill="none"><path d="M9,1.5 L10,7.8 L16.5,9 L10,10.2 L9,16.5 L8,10.2 L1.5,9 L8,7.8 Z" fill="#7C6050" opacity="0.4"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp4}`} viewBox="0 0 10 10" fill="none"><path d="M5,0.5 L5.6,4.4 L9.5,5 L5.6,5.6 L5,9.5 L4.4,5.6 L0.5,5 L4.4,4.4 Z" fill="#1A1A1A" opacity="0.45"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp5}`} viewBox="0 0 16 16" fill="none"><path d="M8,1 L9,6.8 L15,8 L9,9.2 L8,15 L7,9.2 L1,8 L7,6.8 Z" fill="#1A1A1A" opacity="0.55"/></svg>
  </div>
);

// idle | checking | loading | success | error | duplicate
type BtnState = 'idle' | 'checking' | 'loading' | 'success' | 'error' | 'duplicate';

export default function RegisterPage() {
  const { register, loginWithGoogle, loginWithGitHub } = useAuth();

  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [emailError, setEmailError]   = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailValid, setEmailValid]   = useState(false);
  const [password, setPassword]       = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError]             = useState('');
  const [isShaking, setIsShaking]     = useState(false);
  const [btnState, setBtnState]       = useState<BtnState>('idle');

  const BLOCKED_DOMAINS = new Set([
    'mailinator.com','trashmail.com','guerrillamail.com','guerrillamail.net',
    'temp-mail.org','tempmail.com','10minutemail.com','10minutemail.net',
    'yopmail.com','yopmail.fr','throwaway.email','fakeinbox.com',
    'maildrop.cc','sharklasers.com','grr.la','spam4.me','discard.email',
    'spamgourmet.com','mailnull.com','mailnesia.com','trashmail.me',
    'trashmail.at','trashmail.io','trashmail.xyz','wegwerfmail.de',
  ]);

  const validateEmailLocal = (val: string): string => {
    const v = val.trim();
    if (!v) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email address.';
    const domain = v.toLowerCase().split('@')[1] ?? '';
    if (BLOCKED_DOMAINS.has(domain)) return 'Disposable emails are not allowed.';
    return '';
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    // Reset button to idle when user changes email
    if (btnState !== 'idle') setBtnState('idle');
    if (emailTouched) {
      const err = validateEmailLocal(val);
      setEmailError(err);
      setEmailValid(!err);
    }
  };

  const handleEmailBlur = async () => {
    setEmailTouched(true);
    const localErr = validateEmailLocal(email);
    if (localErr) { setEmailError(localErr); setEmailValid(false); return; }
    setBtnState('checking'); setEmailError('');
    try {
      const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
      const res = await fetch(`${API}/auth/check-email?email=${encodeURIComponent(email.trim())}`);
      if (res.ok) {
        const data = await res.json() as { valid: boolean; reason?: string };
        if (!data.valid) { setEmailError(data.reason ?? 'This email cannot receive mail.'); setEmailValid(false); }
        else { setEmailError(''); setEmailValid(true); }
      }
    } catch { /* fail open */ }
    finally { setBtnState('idle'); }
  };

  const shake = () => { setIsShaking(true); setTimeout(() => setIsShaking(false), 600); };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (btnState === 'success') return; // already sent — prevent double-submit

    // ── Field validation ────────────────────────────────────────────────────
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.'); shake(); return;
    }
    const localErr = validateEmailLocal(email);
    if (localErr) {
      setEmailTouched(true); setEmailError(localErr); setEmailValid(false);
      setError(localErr); shake(); return;
    }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); shake(); return; }

    // ── Per-email block check ───────────────────────────────────────────────
    const block = checkBlock(email);
    if (block.permanent) {
      setError('This email has been permanently blocked due to too many failed attempts. Please use a different email address.');
      shake(); return;
    }
    if (block.blocked) {
      setError(`Too many failed attempts. This email is blocked for ${block.minutesLeft} more minute(s). Please try a different email.`);
      shake(); return;
    }

    // ── STEP 1: Check if email already exists in DB ─────────────────────────
    setBtnState('loading');
    try {
      const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
      const existsRes = await fetch(`${API}/auth/check-email-exists?email=${encodeURIComponent(email.trim())}`);
      if (existsRes.ok) {
        const { exists } = await existsRes.json() as { exists: boolean };
        if (exists) {
          setBtnState('duplicate');
          setError('An account with this email already exists. Please log in instead.');
          shake();
          // Reset after 4s so user can try a different email
          setTimeout(() => { setBtnState('idle'); setError(''); }, 4000);
          return;
        }
      }
    } catch { /* fail open — proceed to registration attempt */ }

    // ── STEP 2: MX domain validation (if not yet done) ─────────────────────
    if (!emailValid) {
      setBtnState('checking');
      try {
        const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
        const res = await fetch(`${API}/auth/check-email?email=${encodeURIComponent(email.trim())}`);
        if (res.ok) {
          const data = await res.json() as { valid: boolean; reason?: string };
          if (!data.valid) {
            const msg = data.reason ?? 'This email cannot receive mail.';
            setEmailTouched(true); setEmailError(msg); setEmailValid(false);
            setError(msg); setBtnState('error'); shake();
            setTimeout(() => setBtnState('idle'), 3000);
            return;
          }
          setEmailValid(true); setEmailError('');
        }
      } catch { /* fail open */ }
      finally { setBtnState('loading'); } // hand off to submit phase
    }

    // ── STEP 3: Register + send verification email ──────────────────────────
    try {
      const result = await register(email, password, name);

      // ✅ Email sent — show GREEN for 1.5s then redirect to verification page
      setBtnState('success');
      setTimeout(() => {
        if (result.outcome === 'needsVerification') {
          window.location.href = `/check-email?email=${encodeURIComponent(email)}`;
        } else {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
          window.location.href = `${baseUrl}/projects`;
        }
      }, 1500);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';

      // Duplicate from BetterAuth (race condition — user created between our check and signUp)
      if (msg.toLowerCase().includes('already')) {
        setBtnState('duplicate');
        setError('An account with this email already exists. Please log in instead.');
        shake();
        setTimeout(() => { setBtnState('idle'); setError(''); }, 4000);
        return;
      }

      // ❌ Email send failure or other error — show RED
      setBtnState('error');
      setError(msg);
      shake();
      const rlResult = recordFail(email);
      if (rlResult.permanent) {
        setError('This email has been permanently blocked after too many failed attempts. Please use a different email address.');
      } else if (rlResult.blocked) {
        setError('Too many failed attempts. This email is blocked for 30 minutes. Please use a different email address.');
      }
      setTimeout(() => setBtnState('idle'), 3000);
    }
  };

  // ── Derived flags (single source of truth) ────────────────────────────────
  const emailChecking = btnState === 'checking';
  const isSubmitting  = btnState === 'loading';


  return (
    <div className={`${styles.page} ${styles.dark} dark`}>
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

        {/* ── LEFT VIEW ── */}
        <div className={styles.leftPane}>
          <div className={styles.patternOverlay} />
          <ApioTypeWriter />
          <div className={styles.rightCopy}>
            <div className={styles.introIcon}>
              <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="19" y1="8" x2="19" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="16" y1="11" x2="22" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className={styles.introTitle}>Create your account</h1>
            <p className={styles.introSub}>Join Apio to monitor your APIs</p>
          </div>
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
          <div className={styles.rightUtilLinks}>
            <span className={styles.rightForgotLink}>Already have an account?</span>
            <Link href="/login" className={styles.rightRegisterLink}>Log in →</Link>
          </div>
        </div>

        {/* ── RIGHT VIEW ── */}
        <div className={styles.rightPane}>
          <div className={styles.noiseOverlay} />
          <SpringBackground />
          <main className={styles.main}>
            <style dangerouslySetInnerHTML={{__html: `
              .apio-autofill-transparent:-webkit-autofill,
              .apio-autofill-transparent:-webkit-autofill:hover,
              .apio-autofill-transparent:-webkit-autofill:focus,
              .apio-autofill-transparent:-webkit-autofill:active {
                transition: background-color 5000s ease-in-out 0s, color 5000s ease-in-out 0s !important;
              }
            `}} />
            <div className={styles.card}>
              <form className={styles.form} onSubmit={handleRegister} noValidate>

                {/* Name */}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="register-name">Full Name</label>
                  <div className={`${styles.input} ${styles.inputWrapper} ${isShaking ? styles.inputError : ''}`}>
                    <input
                      id="register-name"
                      className="apio-autofill-transparent"
                      type="text"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      disabled={isSubmitting}
                      suppressHydrationWarning
                      style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: 0, margin: 0, color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit' }}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="register-email">Email</label>
                  <div className={`${styles.input} ${styles.inputWrapper} ${isShaking && !email.trim() ? styles.inputError : ''} ${emailTouched && emailError && !emailChecking ? styles.inputError : ''}`}>
                    <input
                      id="register-email"
                      className="apio-autofill-transparent"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      onBlur={handleEmailBlur}
                      autoComplete="email"
                      required
                      disabled={emailChecking || isSubmitting}
                      aria-describedby={emailError ? 'email-error' : emailChecking ? 'email-checking' : undefined}
                      aria-invalid={emailTouched && !!emailError && !emailChecking}
                      suppressHydrationWarning
                      style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: 0, margin: 0, color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', opacity: emailChecking ? 0.6 : 1 }}
                    />
                  </div>
                  {emailChecking && (
                    <span id="email-checking" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500, marginTop: '4px', paddingLeft: '2px' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      Checking email domain…
                    </span>
                  )}
                  {emailTouched && emailError && !emailChecking && (
                    <span id="email-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#ef4444', fontWeight: 500, marginTop: '4px', paddingLeft: '2px' }}>
                      <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12" style={{ flexShrink: 0 }}>
                        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                      </svg>
                      {emailError}
                    </span>
                  )}
                </div>

                {/* Password */}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="register-password">Password</label>
                  <div style={{ position: 'relative' }}>
                    <AnimatedPasswordInput
                      id="register-password"
                      wrapperClassName={`${styles.input} ${styles.passwordWrapper} ${isShaking ? styles.inputError : ''}`}
                      placeholder="6–15 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPasswordTouched(true)}
                      autoComplete="new-password"
                      required
                    />
                    <PasswordStrengthPanel
                      password={password}
                      visible={passwordTouched}
                    />
                  </div>
                </div>

                {/* Error banner */}
                {error && (
                  <div role="alert" aria-live="polite" className={styles.errorBanner}>
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0, marginTop: '1px' }}>
                      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                {/* Submit button — wrapperClassName handles animation, className handles state colours */}
                <GooeyButton
                  type="submit"
                  wrapperClassName={styles.submitBtnWrapper}
                  className={[
                    btnState === 'success'   ? styles.submitBtnSuccess   : '',
                    btnState === 'error'     ? styles.submitBtnError     : '',
                    btnState === 'duplicate' ? styles.submitBtnDuplicate : '',
                  ].filter(Boolean).join(' ')}
                  isLoading={isSubmitting || emailChecking}
                  disabled={isSubmitting || emailChecking || btnState === 'success'}
                  icon={
                    btnState === 'success' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : btnState === 'error' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    ) : btnState === 'duplicate' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <line x1="19" y1="8" x2="19" y2="14" />
                        <line x1="22" y1="11" x2="16" y2="11" />
                      </svg>
                    )
                  }
                >
                  {emailChecking ? (
                    <span className={styles.loaderContent}><ButtonLogoSpinner />Verifying email…</span>
                  ) : isSubmitting ? (
                    <span className={styles.loaderContent}><ButtonLogoSpinner />Verifying &amp; sending…</span>
                  ) : btnState === 'success' ? (
                    '✓ Verification email sent!'
                  ) : btnState === 'error' ? (
                    'Failed — check details'
                  ) : btnState === 'duplicate' ? (
                    '! Account already exists'
                  ) : (
                    'Create Account'
                  )}
                </GooeyButton>
              </form>

              <div className={styles.divider}>
                <span className={styles.dividerLine} />
                <span className={styles.dividerText}>or continue with</span>
                <span className={styles.dividerLine} />
              </div>

              <div className={styles.oauthRow}>
                <GooeyButton type="button" className={styles.oauthBtn} wrapperClassName={styles.oauthBtnWrapper} aria-label="Sign up with Google" onClick={loginWithGoogle} disableGooeyFilter>
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </GooeyButton>
                <GooeyButton type="button" className={styles.oauthBtn} wrapperClassName={styles.oauthBtnWrapper} aria-label="Sign up with GitHub" onClick={loginWithGitHub} disableGooeyFilter>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                  GitHub
                </GooeyButton>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
