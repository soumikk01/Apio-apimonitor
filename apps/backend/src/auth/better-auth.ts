import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { emailOTP, twoFactor } from 'better-auth/plugins';
import { PrismaClient } from '../generated/prisma';
import { validateEmail } from './email-validator';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { otpTemplate, OtpType } from '../email/templates/otp.template';
import { emailVerificationTemplate } from '../email/templates/email-verification.template';
import { welcomeTemplate } from '../email/templates/welcome.template';

// ── Prisma client (singleton — shared with the rest of the app) ───────────────
// BetterAuth 1.6.9 generates random base-62 string IDs that are not valid
// MongoDB ObjectIds (Prisma P2023). We intercept .create() calls on the
// BetterAuth-managed models and silently replace any non-ObjectId string
// with a proper 24-char hex ObjectId via a JS Proxy (no $extends needed).
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

// ── Password helpers (bcrypt) ─────────────────────────────────────────────────
// BetterAuth v1.6.9 defaults to scrypt. Old migrated accounts use bcrypt
// ($2a$ prefix). Providing custom hash/verify locks ALL passwords to bcrypt
// so every sign-up and sign-in uses the same algorithm.
const passwordBcrypt = {
  hash: (password: string) => bcrypt.hash(password, 12),
  verify: ({ hash, password }: { hash: string; password: string }) =>
    bcrypt.compare(password, hash),
};

// ── MongoDB ObjectId Proxy ───────────────────────────────────────────────────
// BetterAuth 1.6.9 generates random base-62 string IDs (e.g. "mUA9wWo4...").
// MongoDB/Prisma requires 24-char hex ObjectIds (P2023). This Proxy silently
// converts any non-ObjectId string ID to a valid ObjectId on every .create().
function fixIdOnCreate(
  model: Record<string, unknown>,
): Record<string, unknown> {
  return new Proxy(model, {
    get(target, prop) {
      if (prop === 'create') {
        return async (args: Record<string, unknown>) => {
          const data = args?.data as Record<string, unknown> | undefined;
          if (
            data?.id &&
            typeof data.id === 'string' &&
            !OBJECT_ID_RE.test(data.id)
          ) {
            const newId = randomBytes(12).toString('hex');
            data.id = newId;
          }
          return (target.create as (args: Record<string, unknown>) => unknown)(
            args,
          );
        };
      }
      // Bind all other methods so Prisma internals keep correct 'this'
      const val = (target as Record<string, unknown>)[prop as string];
      return typeof val === 'function'
        ? (val as (...args: unknown[]) => unknown).bind(target)
        : val;
    },
  });
}

const _rawPrisma = new PrismaClient();
// Proxy the Prisma client so BetterAuth model creates go through fixIdOnCreate.
// All returned functions are .bind(target) to preserve Prisma's 'this' context.
const prisma = new Proxy(_rawPrisma, {
  get(target, prop: string) {
    const value = (target as unknown as Record<string, unknown>)[prop];
    if (
      ['user', 'session', 'account', 'verification', 'twoFactor'].includes(
        prop,
      ) &&
      typeof value === 'object' &&
      value !== null
    ) {
      return fixIdOnCreate(value as Record<string, unknown>);
    }
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(target)
      : value;
  },
}) as PrismaClient;

// ── Resend HTTP API sender ────────────────────────────────────────────────────
// More reliable than SMTP: no connection pooling, explicit error responses,
// and guaranteed delivery confirmation on every call.
// SMTP_PASS is the Resend API key (re_xxxxxx).
const _resendApiKey = process.env.SMTP_PASS;

// ── Startup check ─────────────────────────────────────────────────────────────
if (!_resendApiKey) {
  console.error(
    '\n[BetterAuth] ❌ SMTP_PASS (Resend API key) NOT SET — verification emails will NOT be sent!\n' +
      '  Set SMTP_PASS=re_xxxxxx in apps/backend/.env\n',
  );
} else {
  console.log('[BetterAuth] ✅ Resend API key loaded — email sender ready.');
}

const FROM_EMAIL = process.env.EMAIL_FROM ?? 'Apio <noreply@apio.one>';

async function sendMail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!_resendApiKey) {
    console.error(
      `[BetterAuth] ❌ SMTP_PASS (Resend API key) not set — cannot send email to ${to}`,
    );
    throw new Error('Email service is not configured. Please contact support.');
  }

  // ── LAYER 1: Suppression list pre-check ──────────────────────────────────────
  // Resend automatically adds bounced/complained addresses here.
  // Any email that bounced before is instantly blocked — no send attempt.
  try {
    const suppressRes = await fetch(
      `https://api.resend.com/suppressions?email=${encodeURIComponent(to)}`,
      { headers: { Authorization: `Bearer ${_resendApiKey}` } },
    );
    if (suppressRes.ok) {
      const suppressData = (await suppressRes.json()) as { data?: unknown[] };
      if (Array.isArray(suppressData.data) && suppressData.data.length > 0) {
        console.error(
          `[BetterAuth] 🚫 ${to} is on suppression list — previous bounce or complaint`,
        );
        throw new Error(
          'This email address is not deliverable (previously bounced). ' +
            'Please use a different, valid email address.',
        );
      }
    }
  } catch (suppressErr) {
    // Re-throw our own suppression error
    if (
      suppressErr instanceof Error &&
      suppressErr.message.includes('not deliverable')
    )
      throw suppressErr;
    // Suppression API itself failed — proceed optimistically
    console.warn(
      `[BetterAuth] ⚠ Suppression check failed for ${to}: ${(suppressErr as Error).message}`,
    );
  }

  console.log(`[BetterAuth] 📧 Sending "${subject}" → ${to}`);

  // ── LAYER 2: Send via Resend HTTP API ────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${_resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
  } catch (networkErr) {
    const msg =
      networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error(
      `[BetterAuth] ❌ Network error sending email to ${to}: ${msg}`,
    );
    throw new Error('Failed to reach email service. Please try again.');
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => 'unknown');
    console.error(
      `[BetterAuth] ❌ Resend API ${response.status} for ${to}: ${errBody}`,
    );
    let reason = 'The verification email could not be delivered.';
    try {
      const parsed = JSON.parse(errBody) as { name?: string };
      if (parsed.name === 'validation_error' || response.status === 422)
        reason = 'Invalid email address — please check and try again.';
      else if (response.status === 403)
        reason = 'Email sending not authorised. Please contact support.';
      else if (response.status === 429)
        reason = 'Too many attempts. Please wait and try again.';
    } catch {
      /* keep default reason */
    }
    throw new Error(reason);
  }

  const result = (await response.json()) as { id?: string };
  const emailId = result.id;
  console.log(
    `[BetterAuth] ✅ Accepted by Resend for ${to} — id: ${emailId ?? 'unknown'}`,
  );

  if (!emailId) return;

  // ── LAYER 3: Poll for fast bounces (retries at 3 s, 7 s, 12 s) ──────────────
  // Gmail hard bounces take 30-120 s (caught by suppression list on next attempt).
  // Non-Gmail providers often bounce in < 12 s — caught here.
  const POLL_DELAYS_MS = [3000, 4000, 5000];
  for (const delay of POLL_DELAYS_MS) {
    await new Promise<void>((r) => setTimeout(r, delay));
    try {
      const statusRes = await fetch(
        `https://api.resend.com/emails/${emailId}`,
        {
          headers: { Authorization: `Bearer ${_resendApiKey}` },
        },
      );
      if (!statusRes.ok) break;

      const { status = '' } = (await statusRes.json()) as { status?: string };
      console.log(`[BetterAuth] 📊 Poll status for ${to}: "${status}"`);

      if (status === 'bounced') {
        console.error(`[BetterAuth] ❌ Bounce confirmed for ${to}`);
        throw new Error(
          'Verification email bounced — this address does not exist or cannot receive mail. ' +
            'Please check your email address and try again.',
        );
      }
      if (status === 'delivered') {
        console.log(`[BetterAuth] ✅ Delivery confirmed for ${to}`);
        return;
      }
      // 'sent' / 'queued' = still in-flight, keep polling
    } catch (pollErr) {
      if (pollErr instanceof Error && pollErr.message.includes('bounced'))
        throw pollErr;
      console.warn(
        `[BetterAuth] ⚠ Poll failed for ${to}: ${(pollErr as Error).message}`,
      );
      break;
    }
  }
}

const APP_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:4000';

// ── BetterAuth instance ───────────────────────────────────────────────────────

// ── Sign-in before hook — auto-verify legacy accounts ─────────────────────────
// Users created before mandatory email verification was introduced have
// emailVerified: false. BetterAuth blocks their login with EMAIL_NOT_VERIFIED.
// We auto-fix this by detecting ANY user with a password credential and flipping
// emailVerified to true so they can proceed normally.
//
// Covers two legacy patterns:
//   1. Old accounts: password stored directly on User.password field
//   2. New accounts: password stored in Account table (providerId: 'credential')
async function autoVerify2faUser(email: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true, password: true },
    });
    if (!user || user.emailVerified) return; // already verified — nothing to do

    // Pattern 1: legacy user — password stored directly on User model
    const hasDirectPassword = !!user.password;

    // Pattern 2: newer user — password stored in Account table
    const credentialAccount = !hasDirectPassword
      ? await prisma.account.findFirst({
          where: { userId: user.id, providerId: 'credential' },
          select: { id: true },
        })
      : null;

    if (hasDirectPassword || credentialAccount) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
      console.log(`[BetterAuth] ✅ Auto-verified legacy user: ${email}`);
    }
  } catch {
    // Non-fatal — BetterAuth proceeds and will surface any real error itself.
  }
}

const _auth: any = betterAuth({
  // Base URL of THIS server (the NestJS backend)
  baseURL: APP_URL,

  // CRITICAL: Tell BetterAuth where it is mounted in your app.
  // Without this, all internal routing fails because BetterAuth
  // tries to match routes against '/' instead of '/api/v1/auth/better'.
  basePath: '/api/v1/auth/better',

  // ── Rate limiting ────────────────────────────────────────────────────────
  // BetterAuth global rate limit protects /sign-up, /sign-in, OTP, and 2FA
  // endpoints from bulk abuse. Keep it generous — NestJS Throttler (in
  // auth.controller.ts) adds tighter limits on the few truly sensitive paths
  // (e.g. /auth/login, /auth/register) at the API gateway level.
  //
  // OLD VALUE: max: 5 / window: 15 min — far too low.
  // 5 slots covers only 2 registrations (sign-up + sendVerificationEmail each)
  // or 5 login attempts, after which ALL email sending becomes blocked until
  // the 15-min window resets. This was causing "verification email not sent".
  rateLimit: {
    window: 10 * 60, // 10 minutes (seconds)
    max: 100, // 100 requests per window per IP — blocks abuse, not real users
    storage: 'memory',
  },

  // Where BetterAuth sends users after clicking the email verification link
  // Points to apps/auth verify-email page which handles the token
  emailVerificationCallbackURL: `${process.env.AUTH_URL ?? 'http://localhost:3001'}/verify-email`,

  // ── Database ─────────────────────────────────────────────────────────────
  database: prismaAdapter(prisma, {
    provider: 'mongodb',
  }),

  // ── Email & Password ─────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    // Require email verification before login is allowed.
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Use bcrypt for all password ops — makes old migrated accounts work on first sign-in.
    password: passwordBcrypt,
    // NOTE: sendResetPassword is intentionally omitted.
    // The app uses OTP-based reset (emailOTP plugin) only.
  },

  // ── Email Verification (BetterAuth v1.x top-level config) ────────────────
  // In BetterAuth ≥1.x, sendVerificationEmail lives here — NOT in emailAndPassword.
  // sendOnSignUp: true  → BetterAuth auto-calls this on every new sign-up.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: { email: string };
      url: string;
    }) => {
      console.log(
        `[BetterAuth] 🔐 sendVerificationEmail triggered for ${user.email}`,
      );
      console.log(`[BetterAuth] 🔗 Verification URL: ${url}`);
      try {
        await sendMail(
          user.email,
          'Verify your Apio account',
          emailVerificationTemplate(url),
        );
      } catch (emailErr) {
        // ── Zombie-user cleanup ────────────────────────────────────────────────
        // sendMail threw → email was NOT sent. BetterAuth has already written the
        // user row to the DB with emailVerified:false. Delete it now so the same
        // email can be used again on the next registration attempt (no "already
        // exists" orange block on retry).
        console.error(
          `[BetterAuth] ❌ Email failed for ${user.email} — deleting zombie user`,
        );
        try {
          await prisma.user.deleteMany({
            where: { email: user.email, emailVerified: false },
          });
          console.log(`[BetterAuth] 🗑 Zombie user deleted for ${user.email}`);
        } catch (dbErr) {
          console.error(
            `[BetterAuth] ⚠ Could not delete zombie user for ${user.email}:`,
            dbErr,
          );
        }
        // Re-throw so BetterAuth surfaces an error to the frontend (→ red button).
        throw emailErr;
      }
    },
  },

  // ── Social Providers ─────────────────────────────────────────────────────
  // Providers are only registered when both client credentials are present.
  // Leave GOOGLE_CLIENT_ID / GITHUB_CLIENT_ID empty in .env to disable.
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  },

  // ── Plugins ──────────────────────────────────────────────────────────────
  plugins: [
    // 2FA — TOTP (Google Authenticator compatible)
    twoFactor({
      issuer: 'Apio',
    }),

    // Email OTP — for magic link / passwordless (optional, can enable later)
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        const subjects: Record<OtpType, string> = {
          'sign-in': 'Your Apio sign-in code',
          'email-verification': 'Verify your Apio account',
          'forget-password': 'Your Apio password reset code',
        };
        await sendMail(
          email,
          subjects[type] ?? 'Your Apio code',
          otpTemplate(otp, type as OtpType),
        );
      },
    }),
  ],

  // ── Session config ────────────────────────────────────────────────────────
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh session if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5-minute client-side cookie cache
    },
  },

  // ── Email validation hook ─────────────────────────────────────────────────────
  // Runs BEFORE every user creation (email+password AND OAuth).
  // Blocks disposable domains and domains with no MX records.
  databaseHooks: {
    user: {
      create: {
        before: async (user: { email: string }) => {
          const result = await validateEmail(user.email);
          if (!result.valid) {
            throw new Error(result.reason ?? 'Invalid email address.');
          }
          // Return undefined to allow creation to proceed
        },
        // ── Welcome email hook (OAuth users only) ──────────────────────────
        // Fires AFTER BetterAuth creates any new user row.
        //
        // ⚠ DUPLICATE-EMAIL GUARD:
        // Our preRegister flow creates users via prisma.user.create directly,
        // which also triggers this Prisma-level hook. Those users receive their
        // welcome email from AuthService.sendWelcomeEmail (called inside
        // verifyPendingRegistration). To avoid sending a second welcome email,
        // we wait 300 ms then check whether a 'credential' Account row now
        // exists for this user. If it does → preRegister handled it → skip.
        // If not → pure OAuth user → send welcome here.
        after: async (user: {
          id?: string;
          email: string;
          name?: string | null;
        }) => {
          const apiKey = process.env.SMTP_PASS;
          if (!apiKey) return;

          // Fire email asynchronously — never delay the auth response
          setImmediate(async () => {
            try {
              if (user.id) {
                const credAccount = await _rawPrisma.account.findFirst({
                  where: { userId: user.id, providerId: 'credential' },
                  select: { id: true },
                });
                // credential account exists → preRegister user → skip
                if (credAccount) return;
              }
            } catch {
              // DB check failed — proceed to avoid missing OAuth welcome
            }

            const name = user.name ?? user.email.split('@')[0];
            const from = process.env.EMAIL_FROM ?? 'Apio <noreply@apio.one>';
            const dash =
              (process.env.FRONTEND_URL ?? 'https://apio.one') + '/projects';
            const html = welcomeTemplate(name, dash);

            // Non-blocking — never delay OAuth redirect
            fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from,
                to: [user.email],
                subject: 'Welcome to Apio!',
                html,
              }),
            }).catch(() => {
              /* non-critical — never throw */
            });
          });
        },
      },
    },
  },

  // ── Trusted origins (CORS) ─────────────────────────────────────────────────────
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3003',
    'http://localhost:4000',
    // Production URLs (populated from .env on deployment)
    process.env.FRONTEND_URL ?? '',
    process.env.AUTH_URL ?? '',
    process.env.ADMIN_URL ?? '',
  ].filter(Boolean),

  secret: process.env.BETTER_AUTH_SECRET,

  // ── Request hooks ─────────────────────────────────────────────────────────
  // Runs BEFORE every sign-in attempt so we can auto-verify legacy 2FA users
  // whose emailVerified flag is still false (created before verification was mandatory).
  // BetterAuth v1.x: hooks.before is a single function receiving MiddlewareInputContext.
  hooks: {
    before: async (ctx: { path: string; request: Request }) => {
      if (ctx.path === '/sign-in/email') {
        try {
          const body = (await ctx.request.clone().json()) as { email?: string };
          if (body?.email) {
            await autoVerify2faUser(body.email);
          }
        } catch {
          // Non-fatal — proceed with normal sign-in flow
        }
      }
      return undefined;
    },
  },
});

// Export with full inferred type — never cast to `any` as that defeats TS safety.
export const auth = _auth;

export type Auth = typeof _auth;
