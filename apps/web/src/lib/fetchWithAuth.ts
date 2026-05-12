/**
 * fetchWithAuth — production-hardened authenticated fetch wrapper
 *
 * Storage strategy:
 *   accessToken  → localStorage        (survives page refresh, read by JS for Bearer header)
 *   refreshToken → HttpOnly cookie 'rt' (set by backend, NEVER readable by JS — XSS-proof)
 *
 * Key behaviors:
 *  - Singleton refresh deduplication: only ONE /auth/refresh-secure call at a time
 *  - Transient errors (5xx/429/network) → session preserved, not cleared
 *  - Definitive 401/400 on refresh → session cleared (truly expired/revoked)
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

// ── Storage helpers ────────────────────────────────────────────────────────
export const authStorage = {
  getAccessToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  },
  setAccessToken: (t: string): void => {
    if (typeof window !== 'undefined') localStorage.setItem('access_token', t);
  },

  /** Wipe ALL client-side auth state. 'rt' HttpOnly cookie is cleared server-side. */
  clear: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('activeProjectId');
    localStorage.removeItem('userAvatarIndex');
    sessionStorage.removeItem('access_token');
  },

  /** True only if we have an access token locally */
  hasSession: (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('access_token');
  },
};

// ── Singleton refresh ──────────────────────────────────────────────────────
let _refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      // credentials:include → browser sends the 'rt' HttpOnly cookie automatically
      const res = await fetch(`${API}/auth/refresh-secure`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.status === 401 || res.status === 400) {
        authStorage.clear();
        return null;
      }
      if (!res.ok) throw new Error(`refresh_${res.status}`);

      const data = await res.json() as { accessToken?: string };
      if (!data.accessToken) { authStorage.clear(); return null; }

      authStorage.setAccessToken(data.accessToken);
      // Backend rotates the 'rt' cookie automatically in the Set-Cookie header
      return data.accessToken;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

/** Parse JWT expiry without a library */
function getTokenExpiresInMs(token: string | null): number {
  if (!token) return 0;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return Infinity;
    return payload.exp * 1000 - Date.now();
  } catch {
    return 0;
  }
}

/**
 * Drop-in replacement for fetch():
 *  1. Proactively refreshes token if it expires in < 5 min
 *  2. Attaches Bearer token from localStorage
 *  3. On 401 → silently refreshes via HttpOnly cookie and retries ONCE
 *  4. Transient errors → session preserved
 *  5. Definitive failure → session cleared
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const currentToken = authStorage.getAccessToken();
  const expiresIn = getTokenExpiresInMs(currentToken);
  if (expiresIn > 0 && expiresIn < 5 * 60 * 1000) {
    try { await tryRefresh(); } catch { /* ignore transient errors */ }
  }

  const makeReq = (token: string | null) =>
    fetch(url, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let res = await makeReq(authStorage.getAccessToken());
  if (res.status !== 401) return res;

  try {
    const newToken = await tryRefresh();
    if (!newToken) return res;

    res = await makeReq(newToken);
    if (res.status === 401) authStorage.clear();
  } catch {
    console.warn('[fetchWithAuth] Transient refresh error, session preserved');
  }

  return res;
}
