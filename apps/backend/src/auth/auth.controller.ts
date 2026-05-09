import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Query,
  UnauthorizedException,
} from '@nestjs/common';

import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { auth } from './better-auth';
import { validateEmail } from './email-validator';
import { PrismaService } from '../prisma/prisma.service';

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
    short: { ttl: 60_000, limit: 10 },
    medium: { ttl: 60_000, limit: 10 },
  })
  @Get('check-email')
  async checkEmail(@Query('email') email: string) {
    return validateEmail(email ?? '');
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
   * POST /auth/register
   * 3 requests per 5 minutes per IP — prevents account spam
   */
  @Throttle({
    short: { ttl: 300_000, limit: 3 },
    medium: { ttl: 300_000, limit: 3 },
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
    short: { ttl: 60_000, limit: 5 },
    medium: { ttl: 60_000, limit: 5 },
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
    short: { ttl: 60_000, limit: 5 },
    medium: { ttl: 60_000, limit: 5 },
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
    short: { ttl: 60_000, limit: 30 },
    medium: { ttl: 60_000, limit: 30 },
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
  ) {
    // Convert Express request headers to the format BetterAuth expects
    const headers = new Headers();
    Object.entries(req.headers).forEach(([k, v]) => {
      if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v);
    });

    const session = await auth.api.getSession({ headers });
    if (!session?.user?.email)
      throw new UnauthorizedException('No active session');

    return this.authService.sessionToken(session.user.email);
  }
}
