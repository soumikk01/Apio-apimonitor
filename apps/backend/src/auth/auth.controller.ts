import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  Query,
  UnauthorizedException,
  Headers as NestHeaders,
} from '@nestjs/common';
import type { Response } from 'express';

import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { auth } from './better-auth';
import { validateEmail } from './email-validator';
import { PrismaService } from '../prisma/prisma.service';

// ── Cookie helpers ────────────────────────────────────────────────────────────
/** Parse a single cookie value from the raw Cookie header without cookie-parser. */
function parseCookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const match = header.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

/** Set the refresh-token HttpOnly cookie on the response. */
function setRefreshCookie(res: import('express').Response, token: string): void {
  const isSecure = process.env.NODE_ENV === 'production';
  res.cookie('rt', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict', // never sent on cross-site navigations — CSRF-proof
    domain: isSecure ? '.apio.one' : undefined,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  });
}


@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  /**
   * GET /auth/check-email?email=user@example.com
   * Validates email format + disposable domain blocklist + DNS MX lookup.
   * Used by the registration form for real-time feedback.
   * Rate-limited: 10 requests per 60 seconds per IP.
   */
  @Throttle({
    short: { ttl: 60_000, limit: 10 }, // 10 per min (burst)
    medium: { ttl: 300_000, limit: 30 }, // 30 per 5 min (sustained)
  })
  @Get('check-email')
  async checkEmail(@Query('email') email: string) {
    return validateEmail(email ?? '');
  }

  /**
   * GET /auth/check-email-exists?email=user@example.com
   * Checks if an email is already registered in the database.
   * Used before sign-up so the frontend can show "account already exists" immediately.
   * Returns { exists: boolean }
   * Rate-limited: 10 requests per 60 seconds per IP.
   */
  @Throttle({
    short: { ttl: 60_000, limit: 10 }, // 10 per min (burst)
    medium: { ttl: 300_000, limit: 30 }, // 30 per 5 min (sustained)
  })
  @Get('check-email-exists')
  async checkEmailExists(@Query('email') email: string) {
    if (!email?.trim()) return { exists: false };
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    return { exists: !!user };
  }

  /**
   * POST /auth/verify-otp
   * Checks if a forget-password OTP is valid WITHOUT consuming it.
   * The actual OTP consumption happens in the final reset step.
   * Rate-limited: 5 per 60 seconds per IP.
   */
  @Throttle({
    short: { ttl: 60_000, limit: 5 },
    medium: { ttl: 60_000, limit: 5 },
  })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: { email: string; otp: string }) {
    const { email, otp } = body;
    if (!email || !otp || otp.length !== 6) return { valid: false };

    // BetterAuth emailOTP stores verification records with:
    //   identifier = `forget-password-otp-${email}`
    //   value      = `${plainOtp}:${attemptCount}`  (e.g. "483921:0")
    const identifier = `forget-password-otp-${email.trim().toLowerCase()}`;
    const record = await this.prisma.verification.findFirst({
      where: {
        identifier,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) return { valid: false };

    // Strip the trailing ":N" attempt counter before comparing
    const storedOtp = record.value.includes(':')
      ? record.value.slice(0, record.value.lastIndexOf(':'))
      : record.value;

    return { valid: storedOtp === otp };
  }

  /**
   * POST /auth/pre-register
   * Stores pending registration + sends verification email.
   * NO user is written to DB until the email link is clicked.
   * Rate-limited: 3 per 5 minutes per IP.
   */
  @Throttle({
    short: { ttl: 300_000, limit: 3 }, // 3 per 5 min (burst)
    medium: { ttl: 900_000, limit: 5 }, // 5 per 15 min (sustained)
  })
  @Post('pre-register')
  @HttpCode(HttpStatus.OK)
  preRegister(@Body() body: { name: string; email: string; password: string }) {
    return this.authService.preRegister(body);
  }

  /**
   * GET /auth/verify-pending?token=xxx&email=yyy
   * Verifies the pending registration token and CREATES the user in DB.
   * Called when user clicks the verification link in their email.
   * Rate-limited: 10 per 60 seconds per IP.
   */
  @Throttle({
    short: { ttl: 60_000, limit: 10 }, // 10 per min (burst)
    medium: { ttl: 300_000, limit: 20 }, // 20 per 5 min (sustained)
  })
  @Get('verify-pending')
  async verifyPending(
    @Query('token') token: string,
    @Query('email') email: string,
  ) {
    return this.authService.verifyPendingRegistration(token, email);
  }

  /**
   * GET /auth/claim-auto-login?email=xxx
   * Returns (and consumes) the one-time auto-login token generated after
   * email verification. Used by the 'Check your inbox' polling page so the
   * registration device can also auto-login to /projects.
   * Rate-limited: 5 per 60 seconds per IP.
   */
  @Throttle({
    short: { ttl: 60_000, limit: 5 },
    medium: { ttl: 300_000, limit: 10 },
  })
  @Get('claim-auto-login')
  async claimAutoLogin(@Query('email') email: string) {
    if (!email?.trim()) return { token: null };
    const token = await this.authService.claimAutoLoginToken(email);
    return { token: token ?? null };
  }

  /**
   * GET /auth/auto-login?token=xxx&email=xxx
   * Validates the one-time token, creates a real BetterAuth session, sets
   * the session cookie, and redirects the browser to the web app /projects.
   * Rate-limited: 5 per 60 seconds per IP.
   */
  @Throttle({
    short: { ttl: 60_000, limit: 5 },
    medium: { ttl: 300_000, limit: 10 },
  })
  @Get('auto-login')
  async autoLogin(
    @Query('token') token: string,
    @Query('email') email: string,
    @Res() res: Response,
  ) {
    const appUrl = process.env.APP_URL ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const projectsUrl = `${appUrl}/projects`;

    if (!token?.trim() || !email?.trim()) {
      return res.redirect(projectsUrl);
    }

    const sessionToken = await this.authService.autoLoginWithToken(email, token).catch(() => null);
    if (!sessionToken) {
      return res.redirect(projectsUrl);
    }

    // BetterAuth reads the session cookie via getSignedCookie(name, secret) which
    // verifies an HMAC-SHA256 signature appended as "token.signature".
    // Plain unsigned cookies are silently rejected → user appears logged-out.
    // In production BetterAuth also prepends "__Secure-" to the cookie name when
    // the baseURL starts with https://.
    const secret = process.env.BETTER_AUTH_SECRET ?? '';
    const { createHmac } = await import('crypto');
    const signature = createHmac('sha256', secret).update(sessionToken).digest('base64url');
    const signedValue = `${sessionToken}.${signature}`;

    const betterAuthBase = process.env.BETTER_AUTH_BASE_URL ?? 'http://localhost:4000';
    const isSecure = betterAuthBase.startsWith('https://') || process.env.NODE_ENV === 'production';
    const cookiePrefix = isSecure ? '__Secure-' : '';
    const cookieName = `${cookiePrefix}better-auth.session_token`;

    res.cookie(cookieName, signedValue, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      domain: isSecure ? '.apio.one' : undefined,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.redirect(projectsUrl);
  }

  /**
   * POST /auth/reset-password
   * Wraps BetterAuth's email-otp/reset-password endpoint.
   * On success fires a security email showing date, location (geo-IP) and device.
   * Rate-limited: 5 per 5 minutes per IP.
   */
  @Throttle({
    short: { ttl: 300_000, limit: 5 }, // 5 per 5 min (burst)
    medium: { ttl: 900_000, limit: 8 }, // 8 per 15 min (sustained)
  })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: { email: string; otp: string; password: string },
    @Req() req: { headers: Record<string, string | string[] | undefined> },
    @NestHeaders('user-agent') userAgent: string,
  ) {
    return this.authService.resetPasswordWithSecurityEmail(
      body,
      req.headers,
      userAgent ?? '',
    );
  }

  /**
   * POST /auth/register
   * 3 requests per 5 minutes per IP — prevents account spam
   */
  @Throttle({
    short: { ttl: 300_000, limit: 3 }, // 3 per 5 min (burst)
    medium: { ttl: 900_000, limit: 5 }, // 5 per 15 min (sustained)
  })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   * 5 requests per 60 seconds per IP — brute-force protection
   */
  @Throttle({
    short: { ttl: 60_000, limit: 5 }, // 5 per min (burst)
    medium: { ttl: 600_000, limit: 15 }, // 15 per 10 min (sustained)
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/admin/login
   * Issues a separate admin JWT (ADMIN_JWT_SECRET, 7d expiry).
   * Used exclusively by the Admin Panel — tokens cannot access user-only routes.
   */
  @Throttle({
    short: { ttl: 60_000, limit: 5 }, // 5 per min (burst)
    medium: { ttl: 600_000, limit: 10 }, // 10 per 10 min (sustained — stricter for admin)
  })
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  adminLogin(@Body() dto: LoginDto) {
    return this.authService.adminLogin(dto);
  }

  /**
   * POST /auth/refresh
   * 30 requests per 60 seconds — generous for silent token renewal across tabs
   */
  @Throttle({
    short: { ttl: 60_000, limit: 30 }, // 30 per min (generous — multi-tab silent renewal)
    medium: { ttl: 300_000, limit: 120 }, // 120 per 5 min (sustained)
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  /**
   * GET /auth/session-token
   * Bridge endpoint: reads BetterAuth session cookie → issues JWT access+refresh tokens.
   * Called by apps/web on mount to exchange a BetterAuth cookie session for JWT
   * so that all existing /api/v1/* endpoints (which use JwtAuthGuard) keep working.
   * No throttle needed — it only works if a valid BetterAuth cookie exists.
   */
  @SkipThrottle()
  @Get('session-token')
  async sessionToken(
    @Req() req: { headers: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const headers = new Headers();
    Object.entries(req.headers).forEach(([k, v]) => {
      if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v);
    });

    const session = await auth.api.getSession({ headers });
    if (!session?.user?.email)
      throw new UnauthorizedException('No active session');

    const tokens = await this.authService.sessionToken(session.user.email);
    setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  /**
   * POST /auth/refresh
   * Reads refresh token from HttpOnly cookie; rotates it and returns new accessToken.
   */
  @Throttle({
    short: { ttl: 60_000, limit: 30 },
    medium: { ttl: 300_000, limit: 120 },
  })
  @Post('refresh-secure')
  @HttpCode(HttpStatus.OK)
  async refreshSecure(
    @Req() req: { headers: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const rt = parseCookieValue(
      req.headers['cookie'] as string | undefined,
      'rt',
    );
    if (!rt) throw new UnauthorizedException('No refresh token');
    const tokens = await this.authService.refresh(rt);
    setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  /**
   * POST /auth/logout
   * Clears the HttpOnly refresh-token cookie server-side.
   */
  @SkipThrottle()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    const isSecure = process.env.NODE_ENV === 'production';
    res.clearCookie('rt', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      domain: isSecure ? '.apio.one' : undefined,
      path: '/',
    });
    return { ok: true };
  }
}
