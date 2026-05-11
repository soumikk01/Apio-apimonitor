'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { authStorage } from '@/lib/fetchWithAuth';
import styles from './SecurityPage.module.scss';

const BETTER_AUTH = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL.replace('/api/v1', '')}/api/v1/auth/better`
  : 'http://localhost:4000/api/v1/auth/better';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Step =
  | 'idle'          // main view
  | 'choose-method' // password confirm before TOTP setup
  | 'totp-verify'   // scanning QR, entering code to confirm
  | 'disable-confirm' // entering password to disable
  | 'success';

interface TotpSetup {
  totpURI: string;
}

export default function SecurityPage() {
  const { user } = useAuth();

  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form values
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── Load current 2FA state ──────────────────────────────────────────────
  const loadSecurityStatus = useCallback(async () => {
    const token = authStorage.getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { twoFactorEnabled?: boolean };
        setIs2FAEnabled(data.twoFactorEnabled ?? false);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { void loadSecurityStatus(); }, [loadSecurityStatus]);

  const clearForm = () => {
    setPassword(''); setTotpCode(''); setTotpSetup(null);
    setErrorMsg(''); setSuccessMsg(''); setShowPassword(false);
  };

  // ── Safe JSON parse helper ──────────────────────────────────────────────
  const safeJson = async (res: Response): Promise<Record<string, unknown>> => {
    const text = await res.text();
    if (!text.trim()) return {};
    try { return JSON.parse(text) as Record<string, unknown>; } catch { return { _raw: text }; }
  };

  // Human-readable error messages for known BetterAuth codes
  const friendlyError = (code: string | undefined, status: number, fallback: string): string => {
    const map: Record<string, string> = {
      'INVALID_PASSWORD':         'Incorrect password. Please check and try again.',
      'MISSING_OR_NULL_ORIGIN':   'Request origin missing — please reload the page and try again.',
      'TOO_MANY_REQUESTS':        'Too many attempts. Please wait a moment and try again.',
      'SESSION_EXPIRED':          'Your session has expired. Please log out and log back in.',
      'TWO_FACTOR_ALREADY_ENABLED': '2FA is already enabled on this account.',
      'USER_NOT_FOUND':           'Account not found. Please log in again.',
    };
    if (code && map[code]) return map[code];
    if (status === 401 || status === 403) return 'Your session has expired or is invalid. Please log out and log back in.';
    if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (status >= 500) return 'Server error. Please try again in a moment.';
    return fallback;
  };

  // ── Enable TOTP setup ───────────────────────────────────────────────────
  const handleStartEnableTotp = async () => {
    if (!password.trim()) { setErrorMsg('Please enter your current password to continue.'); return; }
    setSaving(true); setErrorMsg('');
    try {
      const res = await fetch(`${BETTER_AUTH}/two-factor/enable`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(friendlyError(data.code as string, res.status, (data.message as string) ?? 'Failed to enable 2FA. Please try again.'));
      }
      setTotpSetup({ totpURI: (data.totpURI as string) ?? '' });
      setPassword('');
      setStep('totp-verify');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'An unexpected error occurred. Please try again.');
    } finally { setSaving(false); }
  };

  // ── Verify TOTP setup code ──────────────────────────────────────────────
  const handleVerifyTotp = async () => {
    if (totpCode.length !== 6) { setErrorMsg('Please enter the complete 6-digit code from your authenticator app.'); return; }
    setSaving(true); setErrorMsg('');
    try {
      const res = await fetch(`${BETTER_AUTH}/two-factor/verify-totp`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(friendlyError(data.code as string, res.status, 'The code is incorrect or expired. Please check your app and try again.'));
      }
      setIs2FAEnabled(true);
      setTwoFactorMethod('totp');
      setStep('success');
      setSuccessMsg('Two-factor authentication is now active!');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Verification failed. Please try again.');
    } finally { setSaving(false); }
  };


  // ── Disable 2FA ─────────────────────────────────────────────────────────
  const handleDisable = async () => {
    if (!password.trim()) { setErrorMsg('Please enter your current password to disable 2FA.'); return; }
    setSaving(true); setErrorMsg('');
    try {
      const res = await fetch(`${BETTER_AUTH}/two-factor/disable`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(friendlyError(data.code as string, res.status, 'Incorrect password or unable to disable 2FA. Please try again.'));
      }
      setIs2FAEnabled(false);
      setStep('idle');
      clearForm();
      setSuccessMsg('Two-factor authentication has been disabled successfully.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to disable 2FA. Please try again.');
    } finally { setSaving(false); }
  };

  const handleCancel = () => { setStep('idle'); clearForm(); };

  // ── QR code URL using Google Charts API ────────────────────────────────
  const qrUrl = totpSetup?.totpURI
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(totpSetup.totpURI)}&size=180x180&margin=10&color=ffffff&bgcolor=111111`
    : null;

  // Extract secret from TOTP URI for manual entry
  const totpSecret = totpSetup?.totpURI
    ? new URL(totpSetup.totpURI).searchParams.get('secret') ?? ''
    : '';

  if (loading) {
    return (
      <main className={styles.content}>
        <div className={styles.header}>
          <h1>Security</h1>
          <p>Loading security settings…</p>
        </div>
        <div className={styles.skeletonCard} />
        <div className={styles.skeletonCard} style={{ height: 80 }} />
      </main>
    );
  }

  return (
    <main className={styles.content}>
      <div className={styles.header}>
        <h1>Security</h1>
        <p>Protect your account with two-factor authentication and manage login security.</p>
      </div>

      {/* ── SUCCESS BANNER ──────────────────────────────────────────── */}
      {successMsg && (
        <div className={styles.successBanner}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* ── TWO FACTOR CARD ─────────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h3>Two-Factor Authentication</h3>
            <p className={styles.panelSub}>
              Add an extra layer of security to your account. When enabled, you&apos;ll be asked
              for a second verification step each time you sign in.
            </p>
          </div>
          <div className={`${styles.statusBadge} ${is2FAEnabled ? styles.statusOn : styles.statusOff}`}>
            {is2FAEnabled ? '✓ Enabled' : 'Disabled'}
          </div>
        </div>

        {/* ── IDLE: Main 2FA status view ─────────────────────────── */}
        {step === 'idle' && (
          <div className={styles.methodGrid}>
            {/* TOTP card — only method */}
            <div className={`${styles.methodCard} ${is2FAEnabled ? styles.methodCardActive : ''}`}>
              <div className={styles.methodIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="24" height="24">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <path d="M12 18h.01" strokeLinecap="round" strokeWidth="2.5" />
                  <path d="M8 6h8M8 10h4" strokeLinecap="round" />
                </svg>
              </div>
              <div className={styles.methodInfo}>
                <div className={styles.methodName}>Authenticator App</div>
                <div className={styles.methodDesc}>Use Google Authenticator, Authy, or any TOTP app to generate time-based codes.</div>
              </div>
              {is2FAEnabled ? (
                <span className={styles.methodBadge}>Active</span>
              ) : (
                <button
                  className={styles.methodBtn}
                  onClick={() => { setStep('choose-method'); clearForm(); }}
                >
                  Enable
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── DISABLE button ──────────────────────────────────────── */}
        {step === 'idle' && is2FAEnabled && (
          <div className={styles.disableRow}>
            <button className={styles.dangerBtn} onClick={() => { setStep('disable-confirm'); clearForm(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              Disable Two-Factor Authentication
            </button>
          </div>
        )}

        {/* ── STEP: Choose method (password confirm) ───────────────── */}
        {step === 'choose-method' && (
          <div className={styles.stepBox}>
            <div className={styles.stepTitle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <path d="M12 18h.01" strokeLinecap="round" strokeWidth="2.5" />
              </svg>
              Set up Authenticator App
            </div>
            <p className={styles.stepSub}>Confirm your identity to continue setup.</p>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Current Password</label>
              <div className={styles.passwordWrap}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrorMsg(''); }}
                  onKeyDown={e => e.key === 'Enter' && void handleStartEnableTotp()}
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(p => !p)}>
                  {showPassword
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {errorMsg && <div className={styles.errorMsg}>{errorMsg}</div>}

            <div className={styles.stepActions}>
              <button className={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
              <button
                className={styles.primaryBtn}
                onClick={() => void handleStartEnableTotp()}
                disabled={saving || !password.trim()}
              >
                {saving ? <span className={styles.spinner} /> : null}
                {saving ? 'Verifying…' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: TOTP scan QR + verify ─────────────────────────── */}
        {step === 'totp-verify' && totpSetup && (
          <div className={styles.stepBox}>
            <div className={styles.stepTitle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <path d="M12 18h.01" strokeLinecap="round" strokeWidth="2.5" />
              </svg>
              Scan with Your Authenticator App
            </div>

            <div className={styles.qrSection}>
              <div className={styles.qrBox}>
                {qrUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrUrl} alt="TOTP QR Code" width={180} height={180} className={styles.qrImage} />
                ) : (
                  <div className={styles.qrPlaceholder}>QR not available</div>
                )}
              </div>
              <div className={styles.qrInstructions}>
                <p className={styles.instructionStep}><span className={styles.stepNum}>1</span> Open <strong>Google Authenticator</strong>, Authy, or any TOTP app</p>
                <p className={styles.instructionStep}><span className={styles.stepNum}>2</span> Tap <strong>&quot;+&quot;</strong> {'->'} <strong>&quot;Scan QR code&quot;</strong></p>
                <p className={styles.instructionStep}><span className={styles.stepNum}>3</span> Scan the QR code on the left</p>
                {totpSecret && (
                  <>
                    <div className={styles.manualKeyLabel}>Or enter manually:</div>
                    <div className={styles.manualKey}>
                      {totpSecret.match(/.{1,4}/g)?.join(' ') ?? totpSecret}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={styles.fieldGroup} style={{ marginTop: '1.5rem' }}>
              <label className={styles.fieldLabel}>Enter the 6-digit code from your app to confirm</label>
              <div className={styles.otpRow}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]"
                    maxLength={1}
                    autoComplete="one-time-code"
                    className={`${styles.otpCell} ${totpCode[i] ? styles.otpCellFilled : ''} ${errorMsg && !totpCode[i] ? styles.otpCellError : ''}`}
                    value={totpCode[i] ?? ''}
                    placeholder="·"
                    onChange={e => {
                      const digit = e.target.value.replace(/\D/g, '').slice(-1);
                      const next = totpCode.split('');
                      next[i] = digit;
                      const joined = next.join('').substring(0, 6);
                      setTotpCode(joined);
                      setErrorMsg('');
                      if (digit && i < 5) otpRefs.current[i + 1]?.focus();
                      if (joined.length === 6) void handleVerifyTotp();
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace') {
                        e.preventDefault();
                        if (totpCode[i]) {
                          setTotpCode(totpCode.substring(0, i) + totpCode.substring(i + 1));
                        } else if (i > 0) {
                          otpRefs.current[i - 1]?.focus();
                          setTotpCode(totpCode.substring(0, i - 1) + totpCode.substring(i));
                        }
                        setErrorMsg('');
                      } else if (e.key === 'ArrowLeft' && i > 0) {
                        e.preventDefault(); otpRefs.current[i - 1]?.focus();
                      } else if (e.key === 'ArrowRight' && i < 5) {
                        e.preventDefault(); otpRefs.current[i + 1]?.focus();
                      } else if (e.key === 'Enter') {
                        void handleVerifyTotp();
                      }
                    }}
                    onPaste={e => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').substring(0, 6);
                      setTotpCode(pasted);
                      setErrorMsg('');
                      const nextIdx = Math.min(pasted.length, 5);
                      otpRefs.current[nextIdx]?.focus();
                      if (pasted.length === 6) void handleVerifyTotp();
                    }}
                    onFocus={e => e.target.select()}
                  />
                ))}
              </div>
            </div>

            {errorMsg && <div className={styles.errorMsg}>{errorMsg}</div>}

            <div className={styles.stepActions}>
              <button className={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
              <button
                className={styles.primaryBtn}
                onClick={() => void handleVerifyTotp()}
                disabled={saving || totpCode.length !== 6}
              >
                {saving ? <span className={styles.spinner} /> : null}
                {saving ? 'Verifying…' : 'Activate 2FA'}
              </button>
            </div>
          </div>
        )}


        {/* ── STEP: Disable 2FA confirm ────────────────────────────── */}
        {step === 'disable-confirm' && (
          <div className={styles.stepBox}>
            <div className={`${styles.stepTitle} ${styles.dangerTitle}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Disable Two-Factor Authentication
            </div>
            <p className={styles.disableWarning}>
              This will remove your extra security protection. Your account will only be protected by your password.
            </p>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Confirm with your current password</label>
              <div className={styles.passwordWrap}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`${styles.input} ${styles.dangerInput}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrorMsg(''); }}
                  onKeyDown={e => e.key === 'Enter' && void handleDisable()}
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(p => !p)}>
                  {showPassword
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {errorMsg && <div className={styles.errorMsg}>{errorMsg}</div>}

            <div className={styles.stepActions}>
              <button className={styles.cancelBtn} onClick={handleCancel}>Keep 2FA</button>
              <button
                className={styles.dangerSolidBtn}
                onClick={() => void handleDisable()}
                disabled={saving || !password.trim()}
              >
                {saving ? <span className={styles.spinner} /> : null}
                {saving ? 'Disabling…' : 'Yes, Disable 2FA'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Success ────────────────────────────────────────── */}
        {step === 'success' && (
          <div className={styles.successStep}>
            <div className={styles.successIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="32" height="32">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h4>Two-Factor Authentication Active!</h4>
            <p>Your account is now protected. You&apos;ll need to verify your identity each time you log in.</p>
            <button className={styles.primaryBtn} onClick={() => { setStep('idle'); setSuccessMsg(''); }}>
              Done
            </button>
          </div>
        )}
      </div>

      {/* ── ACTIVE SESSIONS info ────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h3>Active Sessions</h3>
            <p className={styles.panelSub}>You are currently signed in on this device. Sessions expire after 30 days of inactivity.</p>
          </div>
        </div>
        <div className={styles.sessionItem}>
          <div className={styles.sessionDot} />
          <div className={styles.sessionInfo}>
            <span className={styles.sessionName}>Current session</span>
            <span className={styles.sessionMeta}>This device · Active now</span>
          </div>
          <span className={styles.sessionActive}>Active</span>
        </div>
      </div>

      {/* ── PASSWORD SECURITY TIP ──────────────────────────────────── */}
      <div className={`${styles.panel} ${styles.tipPanel}`}>
        <div className={styles.tipIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </div>
        <div>
          <div className={styles.tipTitle}>Security Tip</div>
          <p className={styles.tipText}>
            Use a unique password for Apio and enable two-factor authentication to protect your API monitoring data.
            Never share your SDK tokens or account credentials with anyone.
          </p>
        </div>
      </div>
    </main>
  );
}
