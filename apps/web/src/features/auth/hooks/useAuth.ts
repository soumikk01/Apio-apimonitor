/**
 * useAuth — apps/web
 *
 * Session strategy (BetterAuth + JWT bridge):
 *  1. Login happens in apps/auth (BetterAuth sets HTTP-only session cookie)
 *  2. apps/web calls GET /api/v1/auth/session-token with credentials:include
 *     → backend reads cookie → issues JWT tokens → stored in localStorage
 *  3. All existing /api/v1/* calls use JWT via fetchWithAuth (unchanged)
 *  4. On logout → clear BetterAuth session + clear localStorage
 *
 * This gives you:
 *  ✅ Secure HTTP-only cookie session (BetterAuth)
 *  ✅ XSS-safe login (no tokens in URL params)
 *  ✅ All existing API routes work unchanged (JWT Bearer still used)
 *  ✅ Google/GitHub OAuth works (redirects back with cookie set)
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, authStorage } from '@/lib/fetchWithAuth';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:3001';

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar: number;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

function syncAvatarToStorage(avatar: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('userAvatarIndex', String(avatar));
    window.dispatchEvent(new Event('avatarChanged'));
  }
}

// Singleton: prevent duplicate /users/me calls across concurrent component mounts
let _profilePromise: Promise<AuthUser> | null = null;
function resetProfilePromise() { _profilePromise = null; }

async function fetchProfile(): Promise<AuthUser> {
  if (_profilePromise) return _profilePromise;
  _profilePromise = (async () => {
    try {
      const res = await fetchWithAuth(`${API}/users/me`);
      if (res.status === 401) {
        const err = new Error('401') as Error & { status: number };
        err.status = 401;
        throw err;
      }
      if (!res.ok) throw new Error(`profile_${res.status}`);
      return await res.json() as AuthUser;
    } finally {
      _profilePromise = null;
    }
  })();
  return _profilePromise;
}

/**
 * Exchange a BetterAuth session cookie for JWT tokens.
 * Returns true if tokens were obtained and stored.
 */
async function exchangeSessionForJwt(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/auth/session-token`, {
      method: 'GET',
      credentials: 'include', // sends BetterAuth cookie; response sets 'rt' HttpOnly cookie
    });
    if (!res.ok) return false;

    const data = await res.json() as { accessToken?: string };
    if (!data.accessToken) return false;

    authStorage.clear();
    resetProfilePromise();
    authStorage.setAccessToken(data.accessToken);
    // refreshToken is now set as HttpOnly cookie 'rt' by the backend — never stored in JS
    return true;
  } catch {
    return false;
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // ── Session restore on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // ── Step 1: Try to exchange BetterAuth cookie for JWT ─────────────────
      // This happens when:
      //   a) User just logged in via apps/auth (BetterAuth set the cookie)
      //   b) User refreshed the page (cookie still valid, localStorage may be empty)
      //   c) OAuth redirect back to apps/web (cookie set by OAuth callback)
      //
      // If the exchange fails (no cookie / expired) and localStorage also has
      // no token → user is logged out.
      const hasLocalJwt = authStorage.hasSession();
      if (!hasLocalJwt) {
        // No local JWT → try to get one from BetterAuth cookie
        const gotJwt = await exchangeSessionForJwt();
        if (!gotJwt) {
          // No cookie session either → fully logged out
          if (!cancelled) {
            setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
          }
          return;
        }
      }

      // ── Step 2: Load user profile with the JWT ────────────────────────────
      try {
        const user = await fetchProfile();
        if (user.avatar !== undefined) syncAvatarToStorage(user.avatar);
        const freshToken = authStorage.getAccessToken();
        if (!cancelled) {
          setState({ user, accessToken: freshToken, isAuthenticated: true, isLoading: false });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const e = err as { status?: number; message?: string };
          const is401 = e?.status === 401 || e?.message === '401';

          if (is401) {
            // JWT expired → try once more to get fresh tokens from cookie
            const renewed = await exchangeSessionForJwt();
            if (renewed) {
              try {
                const user = await fetchProfile();
                if (user.avatar !== undefined) syncAvatarToStorage(user.avatar);
                if (!cancelled) {
                  setState({ user, accessToken: authStorage.getAccessToken(), isAuthenticated: true, isLoading: false });
                }
                return;
              } catch { /* fall through to logout */ }
            }
            // Cookie also expired → hard logout
            authStorage.clear();
            setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
          } else {
            // Transient error (5xx, offline) — keep user logged in
            console.warn('[useAuth] Transient profile error, keeping session:', e?.message);
            setState({ user: null, accessToken: authStorage.getAccessToken(), isAuthenticated: true, isLoading: false });
          }
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    resetProfilePromise();
    authStorage.clear();
    // Clear the HttpOnly 'rt' refresh cookie server-side + BetterAuth session cookie
    await Promise.allSettled([
      fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }),
      fetch(`${API}/auth/better/sign-out`, { method: 'POST', credentials: 'include' }),
    ]);
    setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  }, []);

  const logoutWithTransition = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('show-logout-transition'));
      setTimeout(async () => {
        await logout();
        window.location.href = `${AUTH_URL}/login`;
      }, 1200);
    } else {
      logout();
    }
  }, [logout]);

  return { ...state, logout, logoutWithTransition };
}
