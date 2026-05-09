'use client';

import { useState, useEffect, useCallback } from 'react';
import { authClient } from '@/lib/auth-client';

const BETTER_AUTH_BASE =
  `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/auth/better`;

// ── Error sanitizer ───────────────────────────────────────────────────────────
// Strips raw HTTP paths / network details — shows professional messages instead.
function sanitizeError(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (
    raw.startsWith('Cannot POST') ||
    raw.startsWith('Cannot GET') ||
    raw.includes('/api/') ||
    raw.includes('fetch failed') ||
    raw.includes('NetworkError') ||
    raw.includes('Failed to fetch')
  ) return fallback;
  return raw;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ── useAuth ───────────────────────────────────────────────────────────────────
// Wraps BetterAuth client for all auth operations:
// login, register, logout, OAuth (Google/GitHub), forgot password.
// BetterAuth manages sessions via HTTP-only cookies — no manual token handling.
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // ── Restore session on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    authClient.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data?.user) {
        setState({ user: data.user as AuthUser, isAuthenticated: true, isLoading: false });
      } else {
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    }).catch(() => {
      if (!cancelled) setState({ user: null, isAuthenticated: false, isLoading: false });
    });

    return () => { cancelled = true; };
  }, []);

  // ── Login (email + password) ───────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await authClient.signIn.email({ email, password });

    if (error) {
      if (error.status === 401 || error.status === 403) {
        // BetterAuth returns 403 when email is not verified
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('verify') || msg.includes('verified') || msg.includes('not verified') || error.code === 'EMAIL_NOT_VERIFIED') {
          throw new Error('__EMAIL_NOT_VERIFIED__');
        }
        throw new Error('Incorrect email or password.');
      }
      if (error.status === 429)
        throw new Error('Too many login attempts. Please wait a moment and try again.');
      throw new Error(sanitizeError(error.message, 'Sign in failed. Please try again.'));
    }

    if (!data?.user) throw new Error('Sign in failed. Please try again.');

    setState({ user: data.user as AuthUser, isAuthenticated: true, isLoading: false });

    // Redirect to web dashboard — BetterAuth session cookie is shared via backend
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    window.location.href = `${baseUrl}/projects`;
  }, []);

  // ── Register (email + password) ────────────────────────────────────────────
  const register = useCallback(async (email: string, password: string, name?: string) => {
    const { data, error } = await authClient.signUp.email({
      email,
      password,
      name: name ?? email.split('@')[0],
    });

    if (error) {
      if (error.status === 409 || error.message?.toLowerCase().includes('already'))
        throw new Error('An account with this email already exists.');
      if (error.status === 422 || error.message?.toLowerCase().includes('disposable') || error.message?.toLowerCase().includes('invalid email'))
        throw new Error(error.message ?? 'Please use a valid email address.');
      if (error.status === 429)
        throw new Error('Too many attempts. Please wait a moment and try again.');
      throw new Error(sanitizeError(error.message, 'Registration failed. Please try again.'));
    }

    if (!data?.user) throw new Error('Registration failed. Please try again.');

    // When requireEmailVerification is enabled, emailVerified is false after sign-up.
    // BetterAuth does NOT always auto-send the verification email during sign-up —
    // explicitly request it here so the user always receives the link.
    if (data.user.emailVerified === false) {
      try {
        await authClient.sendVerificationEmail({ email });
      } catch {
        // Non-fatal — user can request resend from the check-email page
      }
      // Pass email in URL so check-email page can display it
      window.location.href = `/check-email?email=${encodeURIComponent(email)}`;
      return;
    }

    setState({ user: data.user as AuthUser, isAuthenticated: true, isLoading: false });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    window.location.href = `${baseUrl}/projects`;
  }, []);

  // ── OAuth — Google ─────────────────────────────────────────────────────────
  const loginWithGoogle = useCallback(async () => {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/projects`,
    });
  }, []);

  // ── OAuth — GitHub ─────────────────────────────────────────────────────────
  const loginWithGitHub = useCallback(async () => {
    await authClient.signIn.social({
      provider: 'github',
      callbackURL: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/projects`,
    });
  }, []);

  // ── Forgot Password (OTP flow) — Step 1: request password reset OTP ────────
  // BetterAuth emailOTP plugin route: POST /email-otp/request-password-reset
  const sendForgotPasswordOtp = useCallback(async (email: string) => {
    const res = await fetch(`${BETTER_AUTH_BASE}/email-otp/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(sanitizeError(data.message, 'Failed to send OTP. Please try again.'));
    }
  }, []);

  // ── Forgot Password (OTP flow) — Step 2: verify OTP + reset password ──────
  // BetterAuth emailOTP plugin route: POST /email-otp/reset-password
  const resetPasswordWithOtp = useCallback(async (email: string, otp: string, password: string) => {
    const res = await fetch(`${BETTER_AUTH_BASE}/email-otp/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, otp, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      const raw = data.message ?? '';
      if (raw.toLowerCase().includes('invalid') || raw.toLowerCase().includes('expired'))
        throw new Error('Invalid or expired code. Please request a new one.');
      throw new Error(sanitizeError(raw, 'Failed to reset password. Please try again.'));
    }
  }, []);

  // ── Reset Password (OTP-based — only active flow) ──────────────────────
  // Link-based reset-password flow removed: /reset-password page no longer exists.
  // The OTP flow (sendForgotPasswordOtp + resetPasswordWithOtp) is the sole path.

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await authClient.signOut();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  const logoutWithTransition = useCallback((router: { push: (url: string) => void }) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('show-logout-transition'));
      setTimeout(async () => {
        await authClient.signOut();
        setState({ user: null, isAuthenticated: false, isLoading: false });
        router.push('/');
      }, 1200);
    } else {
      logout();
      router.push('/');
    }
  }, [logout]);

  return {
    ...state,
    login,
    register,
    loginWithGoogle,
    loginWithGitHub,
    sendForgotPasswordOtp,
    resetPasswordWithOtp,
    logout,
    logoutWithTransition,
  };
}
