'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';
import GooeyButton from '@/components/GooeyButton/GooeyButton';
import GooeyErrorFilter from '@/components/GooeyErrorFilter/GooeyErrorFilter';
import AnimatedPasswordInput from '@/components/AnimatedPasswordInput/AnimatedPasswordInput';
import styles from './ForgotPasswordPage.module.scss';

// ── stages ────────────────────────────────────────────────────────────────────
// FIX 1: Two stages only. OTP + password are on ONE combined form in 'reset'
//         stage — so a wrong OTP is caught on the same screen, not a stage later.
type Stage = 'email' | 'reset';
type BtnState = 'idle' | 'loading' | 'success';

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 300; // 5 minutes — must match BetterAuth's emailOTP expiresIn

/* ── Sparkle background ── */
const SpringBackground = () => (
  <div className={styles.springBg} aria-hidden="true">
    <svg className={`${styles.sparkle} ${styles.sp1}`} viewBox="0 0 20 20" fill="none"><path d="M10,1 L11.2,8.8 L19,10 L11.2,11.2 L10,19 L8.8,11.2 L1,10 L8.8,8.8 Z" fill="#1A1A1A" opacity="0.65"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp2}`} viewBox="0 0 14 14" fill="none"><path d="M7,1 L7.8,6.2 L13,7 L7.8,7.8 L7,13 L6.2,7.8 L1,7 L6.2,6.2 Z" fill="#1A1A1A" opacity="0.5"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp3}`} viewBox="0 0 18 18" fill="none"><path d="M9,1.5 L10,7.8 L16.5,9 L10,10.2 L9,16.5 L8,10.2 L1.5,9 L8,7.8 Z" fill="#7C6050" opacity="0.4"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp4}`} viewBox="0 0 10 10" fill="none"><path d="M5,0.5 L5.6,4.4 L9.5,5 L5.6,5.6 L5,9.5 L4.4,5.6 L0.5,5 L4.4,4.4 Z" fill="#1A1A1A" opacity="0.45"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp5}`} viewBox="0 0 16 16" fill="none"><path d="M8,1 L9,6.8 L15,8 L9,9.2 L8,15 L7,9.2 L1,8 L7,6.8 Z" fill="#1A1A1A" opacity="0.55"/></svg>
  </div>
);

/* ── OTP digit input row ── */
interface OtpInputProps {
  value: string[];
  onChange: (v: string[]) => void;
  hasError: boolean;
  disabled?: boolean;
  firstRef?: React.RefCallback<HTMLInputElement>;
}
const OtpInput = ({ value, onChange, hasError, disabled, firstRef }: OtpInputProps) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKey = useCallback((idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...value];
      if (next[idx]) { next[idx] = ''; onChange(next); }
      else if (idx > 0) { next[idx - 1] = ''; onChange(next); refs.current[idx - 1]?.focus(); }
    }
  }, [value, onChange]);

  const handleChange = useCallback((idx: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...value];
    next[idx] = digit;
    onChange(next);
    if (digit && idx < OTP_LENGTH - 1) refs.current[idx + 1]?.focus();
  }, [value, onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    onChange(next);
    refs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }, [onChange]);

  return (
    <div className={styles.otpRow}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={el => {
            refs.current[i] = el;
            if (i === 0 && firstRef) firstRef(el);
          }}
          id={`otp-digit-${i}`}
          className={`${styles.otpBox} ${hasError ? styles.otpBoxError : ''} ${value[i] ? styles.otpBoxFilled : ''}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          autoComplete="one-time-code"
          aria-label={`OTP digit ${i + 1}`}
          disabled={disabled}
        />
      ))}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
  const { sendForgotPasswordOtp, resetPasswordWithOtp } = useAuth();

  const [stage, setStage]                 = useState<Stage>('email');
  const [email, setEmail]                 = useState('');
  const [otpDigits, setOtpDigits]         = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError]               = useState('');
  const [isShaking, setIsShaking]       = useState(false);
  const [sendBtnState, setSendBtnState] = useState<BtnState>('idle');
  const [resetBtnState, setResetBtnState] = useState<BtnState>('idle');
  const [resending, setResending]       = useState(false);
  // OTP auto-verify state
  const [otpVerifying, setOtpVerifying] = useState(false); // checking with backend
  const [otpVerified, setOtpVerified]   = useState(false); // OTP confirmed correct
  const [otpExiting, setOtpExiting]     = useState(false); // playing exit animation
  // 60-second cooldown before resend is allowed again
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // send attempt tracking — max 3 sends, then 30-min frontend lockout
  const [sendCount, setSendCount]     = useState(0);
  const [lockTimeLeft, setLockTimeLeft] = useState(0);
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_SENDS    = 3;
  const LOCK_SECONDS = 30 * 60; // 30 minutes

  // ── FIX 2: Countdown timer ─────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(OTP_EXPIRY_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(OTP_EXPIRY_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
  }, []);

  const startLockout = () => {
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    setLockTimeLeft(LOCK_SECONDS);
    lockTimerRef.current = setInterval(() => {
      setLockTimeLeft(prev => {
        if (prev <= 1) { clearInterval(lockTimerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const RESEND_COOLDOWN = 60; // seconds
  const startCooldown = () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setResendCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const otpExpired = stage === 'reset' && timeLeft === 0;

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // auto-focus first OTP box when entering reset stage
  const firstOtpRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (stage === 'reset') setTimeout(() => firstOtpRef.current?.focus(), 300);
  }, [stage]);

  const shake = () => { setIsShaking(true); setTimeout(() => setIsShaking(false), 600); };

  // ── Auto-verify OTP when 6th digit is entered ─────────────────────────────
  const checkOtp = async (digits: string[]) => {
    const code = digits.join('');
    if (code.length < OTP_LENGTH || otpVerified || otpVerifying) return;
    setError('');
    setOtpVerifying(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
      const res = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), otp: code }),
      });
      const data = await res.json() as { valid: boolean };
      if (data.valid) {
        // ✅ Correct OTP — play exit animation then reveal password fields
        setOtpExiting(true);
        setTimeout(() => { setOtpVerified(true); setOtpExiting(false); }, 400);
      } else {
        // ❌ Wrong OTP — shake and clear
        setError('Invalid code. Please check your email and try again.');
        shake();
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setTimeout(() => firstOtpRef.current?.focus(), 100);
      }
    } catch {
      setError('Could not verify code. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleOtpChange = (digits: string[]) => {
    setOtpDigits(digits);
    if (digits.join('').length === OTP_LENGTH) checkOtp(digits);
  };

  // ── Stage 1: send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your account email.'); shake(); return; }
    setSendBtnState('loading');
    try {
      await sendForgotPasswordOtp(email.trim());
      setSendCount(1);   // first send
      startCooldown();   // 60s cooldown starts immediately on first send
      setSendBtnState('success');
      setTimeout(() => { setStage('reset'); startTimer(); }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP.');
      shake();
      setSendBtnState('idle');
    }
  };

  // ── Resend OTP ──────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0 || resending || lockTimeLeft > 0) return;
    // Enforce 3-send max: 4th attempt triggers 30-min lockout
    if (sendCount >= MAX_SENDS) {
      startLockout();
      setError('Too many attempts. Please wait 30 minutes before trying again.');
      shake();
      return;
    }
    setError('');
    setResending(true);
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    try {
      await sendForgotPasswordOtp(email.trim());
      const newCount = sendCount + 1;
      setSendCount(newCount);
      startTimer();
      startCooldown();
      // Trigger lockout on the 3rd send so user can't resend after this
      if (newCount >= MAX_SENDS) startLockout();
      setTimeout(() => firstOtpRef.current?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  // ── Stage 2: OTP + password in ONE submit ─────────────────────────────────
  // FIX 1: wrong OTP is caught here, on the same screen where the user typed it.
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpExpired) {
      setError('Your code has expired. Please request a new one.');
      shake();
      return;
    }

    const code = otpDigits.join('');
    if (code.length < OTP_LENGTH) {
      setError(`Enter all ${OTP_LENGTH} digits of your verification code.`);
      shake();
      return;
    }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); shake(); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); shake(); return; }

    setResetBtnState('loading');
    try {
      await resetPasswordWithOtp(email.trim(), code, newPassword);
      if (timerRef.current) clearInterval(timerRef.current);
      setResetBtnState('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password.';
      setError(msg);
      shake();
      // FIX 1: clear OTP boxes so user fixes the code right here, not on another screen
      if (
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('otp') ||
        msg.toLowerCase().includes('code')
      ) {
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setTimeout(() => firstOtpRef.current?.focus(), 100);
      }
      setResetBtnState('idle');
    }
  };

  return (
    <div className={`${styles.page} ${styles.dark}`}>
      <GooeyErrorFilter isError={isShaking} />
      <div className={styles.patternOverlay} />
      <div className={styles.noiseOverlay} />
      <SpringBackground />

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
          <a href={process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'} className={styles.backLink}>← Home</a>
        </nav>
      </header>

      <main className={styles.centerMain}>
        <div className={styles.centerStack}>

          {/* ── ICON + TITLE ── */}
          <div className={styles.topCopy}>
            <div className={`${styles.introIcon} ${resetBtnState === 'success' ? styles.introIconSuccess : ''}`}>
              {resetBtnState === 'success' ? (
                <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <h1 className={styles.introTitle}>
              {resetBtnState === 'success' ? 'Password Updated!' : 'Recover account'}
            </h1>
            <p className={styles.introSub}>
              {resetBtnState === 'success'
                ? 'You can now sign in with your new password'
                : 'Securely reset your Apio password'}
            </p>
          </div>

          {/* ── AUTOFILL STYLE ── */}
          <style dangerouslySetInnerHTML={{__html: `
            .apio-autofill-transparent:-webkit-autofill,
            .apio-autofill-transparent:-webkit-autofill:hover,
            .apio-autofill-transparent:-webkit-autofill:focus,
            .apio-autofill-transparent:-webkit-autofill:active {
              transition: background-color 5000s ease-in-out 0s, color 5000s ease-in-out 0s !important;
            }
          `}} />

          {/* ── CARD ── */}
          {resetBtnState !== 'success' && (
            <div className={styles.card}>

              {/* ── EMAIL FIELD (always visible) ── */}
              <div className={styles.emailSection}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="forgot-email">Account Email</label>
                  <div className={`${styles.inputWrapper} ${styles.input} ${isShaking && stage === 'email' ? styles.inputError : ''} ${stage !== 'email' ? styles.inputFrozen : ''}`}>
                    <input
                      id="forgot-email"
                      className="apio-autofill-transparent"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      disabled={stage !== 'email' || sendBtnState === 'loading'}
                      style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: 0, margin: 0, color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit' }}
                    />
                    {stage === 'reset' && (
                      <span className={styles.sentBadge}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        Sent
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Send OTP button ── */}
                {stage === 'email' && (
                  <form onSubmit={handleSendOtp} noValidate>
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
                      isLoading={sendBtnState === 'loading'}
                      icon={
                        sendBtnState === 'success'
                          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                      }
                    >
                      {sendBtnState === 'loading' ? (
                        <span className={styles.loaderContent}>
                          <svg className={styles.spinnerIcon} viewBox="0 0 24 24">
                            <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                          </svg>
                          Sending…
                        </span>
                      ) : sendBtnState === 'success' ? 'OTP Sent! ✓' : 'Send Verification OTP'}
                    </GooeyButton>
                  </form>
                )}
              </div>

              {/* ── RESET STAGE: OTP + Password in ONE form ── */}
              {stage === 'reset' && (
                <div className={`${styles.otpSection} ${styles.stageEnter}`}>
                  <form onSubmit={handleResetPassword} noValidate>

                    {/* OTP Header + Countdown */}
                    <div className={styles.otpHeader}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.otpIcon}>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      <span>
                        Code sent to <strong>{email}</strong>
                        {/* FIX 2: Countdown timer */}
                        <span
                          style={{
                            marginLeft: '8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: otpExpired ? '#ef4444' : timeLeft <= 60 ? '#f59e0b' : 'rgba(255,255,255,0.35)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {otpExpired ? '⚠ Expired' : `⏱ ${formatTime(timeLeft)}`}
                        </span>
                      </span>
                    </div>

                    {/* ── OTP section — slides out when code is verified ── */}
                    {!otpVerified && (
                      <div className={otpExiting ? styles.otpSectionExiting : undefined}>
                        <OtpInput
                          value={otpDigits}
                          onChange={handleOtpChange}
                          hasError={isShaking}
                          disabled={otpExpired || lockTimeLeft > 0 || otpVerifying}
                          firstRef={el => { firstOtpRef.current = el; }}
                        />

                        {otpVerifying && (
                          <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                            <svg style={{ display: 'inline', marginRight: '5px', animation: 'spin 1s linear infinite' }} width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <circle opacity="0.3" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Verifying…
                          </div>
                        )}

                        <div style={{ marginTop: '0.6rem', textAlign: 'center' }}>
                          {lockTimeLeft > 0 ? (
                            <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                              🔒 Too many attempts. Try again in {formatTime(lockTimeLeft)}
                            </span>
                          ) : otpExpired ? (
                            <button type="button" className={styles.resendLink} onClick={handleResend}
                              disabled={resending || resendCooldown > 0}
                              style={{ opacity: (resending || resendCooldown > 0) ? 0.45 : 1, cursor: (resending || resendCooldown > 0) ? 'not-allowed' : 'pointer' }}>
                              {resending ? 'Sending…' : resendCooldown > 0 ? `Resend in 0:${resendCooldown.toString().padStart(2, '0')}` : '↺ Send new code'}
                            </button>
                          ) : (
                            <button type="button" className={styles.resendLink} onClick={handleResend}
                              disabled={resending || resendCooldown > 0 || otpVerifying}
                              style={{ opacity: (resendCooldown > 0 || resending || otpVerifying) ? 0.45 : 1, cursor: (resendCooldown > 0 || resending || otpVerifying) ? 'not-allowed' : 'pointer' }}>
                              {resending ? 'Sending…' : resendCooldown > 0 ? `Resend in 0:${resendCooldown.toString().padStart(2, '0')}` : 'Resend code'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Password section — slides in only after OTP verified ── */}
                    {otpVerified && (
                      <div className={styles.passwordSectionEntering}>
                        <div className={styles.field} style={{ marginTop: '1.25rem' }}>
                          <label className={styles.label} htmlFor="new-password">New Password</label>
                          <AnimatedPasswordInput
                            id="new-password"
                            wrapperClassName={`${styles.input} ${styles.passwordWrapper} ${isShaking ? styles.inputError : ''}`}
                            placeholder="Min. 8 characters"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            autoComplete="new-password"
                            disabled={resetBtnState === 'loading'}
                          />
                        </div>

                        <div className={styles.field} style={{ marginTop: '1rem' }}>
                          <label className={styles.label} htmlFor="confirm-password">Confirm New Password</label>
                          <AnimatedPasswordInput
                            id="confirm-password"
                            wrapperClassName={`${styles.input} ${styles.passwordWrapper} ${isShaking ? styles.inputError : ''}`}
                            placeholder="Re-enter password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                            disabled={resetBtnState === 'loading'}
                          />
                        </div>
                      </div>
                    )}


                    {/* Error banner — always visible for both OTP and password errors */}
                    {error && (
                      <div role="alert" aria-live="polite" className={styles.errorBanner} style={{ marginTop: '0.75rem' }}>
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0, marginTop: '1px' }}>
                          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
                        </svg>
                        {error}
                      </div>
                    )}

                    {/* Submit button — only after OTP verified */}
                    {otpVerified && (
                      <GooeyButton
                        type="submit"
                        className={styles.submitBtn}
                        isLoading={resetBtnState === 'loading'}
                        icon={
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.8"/>
                          </svg>
                        }
                      >
                        {resetBtnState === 'loading' ? (
                          <span className={styles.loaderContent}>
                            <svg className={styles.spinnerIcon} viewBox="0 0 24 24">
                              <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                            Updating…
                          </span>
                        ) : 'Update Password'}
                      </GooeyButton>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ── SUCCESS ── */}
          {resetBtnState === 'success' && (
            <div className={styles.successActions}>
              <Link href="/login" className={styles.signInBtn}>Sign in now →</Link>
            </div>
          )}

          {/* ── BOTTOM LINKS ── */}
          {resetBtnState !== 'success' && (
            <div className={styles.bottomUtilLinks}>
              <span className={styles.bottomForgotLink}>Remembered your password?</span>
              <Link href="/login" className={styles.bottomRegisterLink}>Log in →</Link>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
