import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { emailOTP, twoFactor } from 'better-auth/plugins';
import { PrismaClient } from '../generated/prisma';
import { validateEmail } from './email-validator';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { otpTemplate, OtpType } from '../email/templates/otp.template';
import { emailVerificationTemplate } from '../email/templates/email-verification.template';

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

// ── Nodemailer transporter (Gmail SMTP — mirrors EmailService) ───────────────
const _smtpUser = process.env.SMTP_USER;
const _smtpPass = process.env.SMTP_PASS;

const _smtpHost = process.env.SMTP_HOST ?? 'smtp.resend.com';
const _smtpPort = Number(process.env.SMTP_PORT ?? 465);

const smtpTransporter =
  _smtpUser && _smtpPass
    ? nodemailer.createTransport({
        host: _smtpHost,
        port: _smtpPort,
        secure: _smtpPort === 465,
        auth: { user: _smtpUser, pass: _smtpPass },
      })
    : null;

async function sendMail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!smtpTransporter) {
    console.warn(
      `[BetterAuth] ⚠ Email not sent to ${to} — SMTP_USER/SMTP_PASS not configured.`,
    );
    return;
  }
  console.log(
    `[BetterAuth] 📧 Attempting to send "${subject}" to ${to} via ${_smtpHost}:${_smtpPort}`,
  );
  try {
    const info = await smtpTransporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    console.log(
      `[BetterAuth] ✅ Email sent to ${to} — messageId: ${info.messageId}`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[BetterAuth] ❌ Failed to send email to ${to}: ${msg}`);
    // Re-throw so BetterAuth doesn't silently ignore the failure
    throw err;
  }
}

const FROM_EMAIL = process.env.EMAIL_FROM ?? _smtpUser ?? 'noreply@apio.one';
// ↑ Used in sendMail() above — keeps EMAIL_FROM consistent with EmailService
const APP_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:4000';

// ── BetterAuth instance ───────────────────────────────────────────────────────

const _auth: any = betterAuth({
  // Base URL of THIS server (the NestJS backend)
  baseURL: APP_URL,

  // CRITICAL: Tell BetterAuth where it is mounted in your app.
  // Without this, all internal routing fails because BetterAuth
  // tries to match routes against '/' instead of '/api/v1/auth/better'.
  basePath: '/api/v1/auth/better',

  // ── Rate limiting (FIX: brute-force OTP protection) ──────────────────────
  // Limits all auth endpoints to 5 requests per 15 minutes per IP.
  // This prevents brute-forcing the 6-digit OTP (10^6 combos → blocked after 5 attempts).
  rateLimit: {
    window: 15 * 60, // 15 minutes (seconds)
    max: 5, // max 5 requests per window per IP on sensitive endpoints
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
      await sendMail(
        user.email,
        'Verify your Apio account',
        emailVerificationTemplate(url),
      );
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

  // ── Email validation hook ─────────────────────────────────────────────────
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
});

export const auth: any = _auth;

export type Auth = typeof _auth;
