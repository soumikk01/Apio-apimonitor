import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { auth } from './better-auth';

/**
 * BetterAuthController
 *
 * Bridges NestJS/Express requests to BetterAuth's Fetch-based handler.
 * Handles all routes under /api/v1/auth/better/*
 *
 * Key design notes:
 * - Uses x-forwarded-* headers so Cloudflare tunnel URLs are preserved correctly
 * - Re-serializes body since Express body-parser already consumed the stream
 * - Skips NestJS throttler (BetterAuth has its own rate limiting)
 */
@SkipThrottle()
@Controller('auth/better')
export class BetterAuthController {
  @All('*path')
  async handler(@Req() req: Request, @Res() res: Response) {
    // ── Reconstruct the public-facing URL ──────────────────────────────────
    // When behind a Cloudflare tunnel or reverse proxy, the host/protocol come
    // from x-forwarded-* headers, not req.protocol / req.headers.host.
    const proto =
      (req.headers['x-forwarded-proto'] as string) ?? req.protocol ?? 'http';
    const host =
      (req.headers['x-forwarded-host'] as string) ??
      req.headers.host ??
      'localhost:4000';

    const url = new URL(req.originalUrl, `${proto}://${host}`);

    // ── Build Fetch-compatible headers ────────────────────────────────────
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else if (value != null) {
        headers.set(key, value);
      }
    }
    // Ensure content-type is set for JSON bodies
    if (
      req.body &&
      typeof req.body === 'object' &&
      !headers.has('content-type')
    ) {
      headers.set('content-type', 'application/json');
    }

    // ── Build Fetch Request ───────────────────────────────────────────────
    const fetchRequest = new globalThis.Request(url.toString(), {
      method: req.method,
      headers,
      body:
        req.method !== 'GET' && req.method !== 'HEAD'
          ? JSON.stringify(req.body)
          : undefined,
    });

    // ── Delegate to BetterAuth ────────────────────────────────────────────
    // Use `globalThis.Response` (Fetch API) — not Express's `Response` import.
    let fetchRes: InstanceType<typeof globalThis.Response>;
    try {
      fetchRes = await auth.handler(fetchRequest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[BetterAuth] handler threw:', msg);
      res.status(500).json({ error: 'Auth handler error', message: msg });
      return;
    }

    // ── Write response back to Express ────────────────────────────────────
    res.status(fetchRes.status);

    // ── IMPORTANT: Handle multiple Set-Cookie headers correctly ───────────
    // BetterAuth sets 2 cookies per auth response:
    //   1. better-auth.session_token  (30-day, the actual auth token)
    //   2. better-auth.session_data   (5-min cache, avoids DB on every request)
    //
    // res.setHeader('set-cookie', value) OVERWRITES on each forEach() call,
    // so only the last cookie survives. We must collect them all and set once.
    //
    // headers.getSetCookie() is the WHATWG-standard API for multi-value cookies.
    // Falls back to parsing from headers.get() for older runtimes.
    const setCookies: string[] =
      typeof fetchRes.headers.getSetCookie === 'function'
        ? fetchRes.headers.getSetCookie()
        : [];

    fetchRes.headers.forEach((value, key) => {
      const lk = key.toLowerCase();
      // Skip transfer-encoding (Express handles chunked encoding itself)
      // Skip set-cookie (handled separately above to avoid overwrite bug)
      if (lk === 'transfer-encoding' || lk === 'set-cookie') return;
      res.setHeader(key, value);
    });

    // Set ALL cookies at once — Express serializes an array as multiple Set-Cookie lines
    if (setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }

    const body = await fetchRes.text();
    // Log non-2xx responses for debugging
    if (fetchRes.status >= 400) {
      console.error(
        `[BetterAuth] ${req.method} ${req.originalUrl} → ${fetchRes.status}: ${body || '(empty body)'}`,
      );
    }
    res.send(body);
  }
}
