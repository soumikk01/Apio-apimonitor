import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { pendingVerificationTemplate } from '../email/templates/pending-verification.template';
import { welcomeTemplate } from '../email/templates/welcome.template';
import { passwordChangedTemplate } from '../email/templates/password-changed.template';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // ── Send welcome email (non-blocking, fire-and-forget) ───────────────────
  private sendWelcomeEmail(email: string, name: string): void {
    const apiKey    = this.config.get<string>('SMTP_PASS');
    const fromEmail = this.config.get('EMAIL_FROM', 'Apio <noreply@apio.one>');
    const dashUrl   = this.config.get('FRONTEND_URL', 'https://apio.one') + '/projects';
    if (!apiKey) return;
    const html = welcomeTemplate(name, dashUrl);
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: [email], subject: 'Welcome to Apio!', html }),
    }).catch(() => { /* non-critical — never throw */ });
  }

  // ── Reset password via BetterAuth OTP + send security email ────────────────
  async resetPasswordWithSecurityEmail(
    body: { email: string; otp: string; password: string },
    reqHeaders: Record<string, string | string[] | undefined>,
    userAgent: string,
  ) {
    // ── 1. Proxy to BetterAuth's OTP reset endpoint ───────────────────────────
    const betterAuthBase = this.config.get(
      'BETTER_AUTH_URL',
      'http://localhost:4000/api/v1/auth/better',
    );
    const resetRes = await fetch(`${betterAuthBase}/email-otp/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resetRes.ok) {
      const errData = await resetRes.json().catch(() => ({})) as { message?: string };
      const msg = errData.message ?? '';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired'))
        throw new BadRequestException('Invalid or expired code. Please request a new one.');
      throw new BadRequestException(msg || 'Failed to reset password.');
    }

    // ── 2. Extract IP address ───────────────────────────────────────────────────
    const fwd   = reqHeaders['x-forwarded-for'];
    const rawIp = Array.isArray(fwd) ? fwd[0] : (fwd ?? reqHeaders['x-real-ip'] ?? 'unknown');
    const ip    = (Array.isArray(rawIp) ? rawIp[0] : rawIp)?.split(',')[0]?.trim() ?? 'unknown';

    // ── 3. Geo-IP lookup (ip-api.com — free, no key needed) ─────────────────────
    let location = 'Unknown location';
    if (ip !== 'unknown' && !ip.startsWith('127.') && !ip.startsWith('::1')) {
      try {
        const geo = await fetch(
          `http://ip-api.com/json/${ip}?fields=status,city,regionName,country`,
          { signal: AbortSignal.timeout(3000) },
        );
        if (geo.ok) {
          const g = await geo.json() as { status: string; city?: string; regionName?: string; country?: string };
          if (g.status === 'success')
            location = [g.city, g.regionName, g.country].filter(Boolean).join(', ');
        }
      } catch { /* proceed with unknown */ }
    }

    // ── 4. Parse user-agent to a human-readable device string ──────────────────
    const device = parseDevice(userAgent);

    // ── 5. Look up user name for personalisation ─────────────────────────────
    const userRow = await this.prisma.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
      select: { name: true },
    });
    const name = userRow?.name ?? body.email.split('@')[0];

    // ── 6. Send security email (non-blocking) ──────────────────────────────
    const apiKey    = this.config.get<string>('SMTP_PASS');
    const fromEmail = this.config.get('EMAIL_FROM', 'Apio <noreply@apio.one>');
    if (apiKey) {
      const html = passwordChangedTemplate({
        name,
        email: body.email,
        changedAt: new Date(),
        location,
        ip,
        device,
      });
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [body.email],
          subject: '⚠️ Your Apio password was changed',
          html,
        }),
      }).catch(() => { /* non-critical */ });
    }

    return { success: true };
  }

  // ── PENDING REGISTRATION (verify-first) ───────────────────────────────────
  // Flow: preRegister → email sent → user clicks link → verifyPendingRegistration
  // → User + Account written to DB → redirect to login
  // NO user data is written to the DB until the email link is clicked.
  // ─────────────────────────────────────────────────────────────────────────

  private readonly PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly PENDING_PREFIX = 'pending-reg::';

  async preRegister(dto: { name: string; email: string; password: string }) {
    const email = dto.email.trim().toLowerCase();

    // ── Already a verified user? ────────────────────────────────────────────
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { emailVerified: true },
    });
    if (existing?.emailVerified) {
      throw new ConflictException('An account with this email already exists. Please log in.');
    }

    // ── Delete any stale pending registration for same email ────────────────
    await this.prisma.verification.deleteMany({
      where: { identifier: { startsWith: this.PENDING_PREFIX + email } },
    });

    // ── Store pending registration ──────────────────────────────────────────
    const token = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const expiresAt = new Date(Date.now() + this.PENDING_TTL_MS);

    await this.prisma.verification.create({
      data: {
        identifier: this.PENDING_PREFIX + email,
        value: JSON.stringify({ token, name: dto.name, email, hashedPassword }),
        expiresAt,
      },
    });

    // ── Send verification email via Resend HTTP API ─────────────────────────
    const authUrl = this.config.get('AUTH_URL', 'http://localhost:3001');
    const apiKey  = this.config.get<string>('SMTP_PASS');
    const fromEmail = this.config.get('EMAIL_FROM', 'Apio <noreply@apio.one>');

    if (!apiKey) throw new BadRequestException('Email service not configured.');

    const verifyUrl = `${authUrl}/verify-pending?token=${token}&email=${encodeURIComponent(email)}`;
    const html = pendingVerificationTemplate(dto.name, verifyUrl);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: [email], subject: 'Verify your Apio account', html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // Clean up pending registration so user can retry
      await this.prisma.verification.deleteMany({
        where: { identifier: this.PENDING_PREFIX + email },
      });
      let reason = 'Failed to send verification email. Please check your email address.';
      try {
        const parsed = JSON.parse(body) as { name?: string };
        if (parsed.name === 'validation_error' || res.status === 422)
          reason = 'This email address is invalid. Please use a real email address.';
      } catch { /* keep default */ }
      throw new BadRequestException(reason);
    }

    // ── Non-blocking bounce check (fire-and-forget) ────────────────────────
    // We return the success response immediately once Resend accepts the email.
    // A background check runs after 3 s to catch fast bounces from non-Gmail
    // providers. If a bounce is detected the pending record is cleaned up so
    // the user can retry with a valid address — but we never block the response.
    const resBody = await res.json() as { id?: string };
    const emailId = resBody.id;
    if (emailId) {
      // Capture vars for closure
      const pendingPrefix = this.PENDING_PREFIX;
      const prismaRef     = this.prisma;
      const apiKeyRef     = apiKey;

      setTimeout(() => {
        fetch(`https://api.resend.com/emails/${emailId}`, {
          headers: { 'Authorization': `Bearer ${apiKeyRef}` },
        })
          .then((check) => check.ok ? check.json() : null)
          .then((data: { status?: string } | null) => {
            if (data?.status === 'bounced') {
              console.warn(`[AuthService] Bounce detected for ${email} — cleaning up pending record`);
              prismaRef.verification.deleteMany({
                where: { identifier: pendingPrefix + email },
              }).catch(() => { /* non-critical */ });
            }
          })
          .catch(() => { /* poll failure — proceed optimistically */ });
      }, 3000);
    }

    return { message: 'Verification email sent. Please check your inbox.' };
  }

  async verifyPendingRegistration(token: string, email: string) {
    const normalEmail = email.trim().toLowerCase();

    const record = await this.prisma.verification.findFirst({
      where: {
        identifier: this.PENDING_PREFIX + normalEmail,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      throw new NotFoundException('Verification link is invalid or has expired. Please register again.');
    }

    const { token: storedToken, name, hashedPassword } = JSON.parse(record.value) as {
      token: string; name: string; hashedPassword: string;
    };

    if (storedToken !== token) {
      throw new BadRequestException('Invalid verification token.');
    }

    // ── Check user not already created (race condition guard) ───────────────
    const alreadyExists = await this.prisma.user.findUnique({ where: { email: normalEmail } });
    if (alreadyExists) {
      await this.prisma.verification.delete({ where: { id: record.id } });
      return { message: 'Account already verified. Please log in.' };
    }

    // ── CREATE USER in DB ─ only happens AFTER email verification ───────────
    const now = new Date();
    const user = await this.prisma.user.create({
      data: {
        email: normalEmail,
        name: name || normalEmail.split('@')[0],
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    // ── CREATE credential Account (BetterAuth format) ───────────────────────
    await this.prisma.account.create({
      data: {
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });

    // ── Clean up pending record ─────────────────────────────────────────────
    await this.prisma.verification.delete({ where: { id: record.id } });

    // ── Send welcome email (non-blocking) ───────────────────────────────────
    this.sendWelcomeEmail(normalEmail, name || normalEmail.split('@')[0]);

    return { success: true, email: normalEmail };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const hash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hash,
        name: dto.name,
      },
    });

    return this.signTokens(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.password)
      throw new UnauthorizedException('Invalid credentials');

    // user.password is guaranteed non-null by the guard above
    const passwordMatch = await bcrypt.compare(dto.password, user.password!);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    return this.signTokens(user.id, user.email);
  }

  // ── Admin Login ───────────────────────────────────────────────────────────
  // Issues a long-lived token (ADMIN_JWT_EXPIRY, default 7d) using the same
  // JWT_SECRET as regular users — so it works with ALL existing guards without
  // any extra strategies or module changes.
  async adminLogin(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.password) throw new UnauthorizedException('Invalid credentials');

    // user.password is guaranteed non-null by the guard above
    const passwordMatch = await bcrypt.compare(dto.password, user.password!);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    const jwtSecret = this.config.get<string>('JWT_SECRET');
    if (!jwtSecret) throw new Error('JWT_SECRET must be configured');

    const expiry = this.config.get<string>('ADMIN_JWT_EXPIRY', '7d');
    // Include role in payload so AdminGuard can verify the token type
    const payload = { sub: user.id, email: user.email, role: 'admin' as const };

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: expiry,
    } as Parameters<typeof this.jwtService.sign>[1]);

    // Also issue a matching refresh token so silent renewal works
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    const refreshToken = refreshSecret
      ? this.jwtService.sign(payload, {
          secret: refreshSecret,
          expiresIn: this.config.get('JWT_REFRESH_EXPIRY', '30d'),
        } as Parameters<typeof this.jwtService.sign>[1])
      : undefined;

    return {
      accessToken,
      refreshToken,
      role: 'admin',
      email: user.email,
      name: user.name,
      expiresIn: expiry,
    };
  }

  private signTokens(userId: string, email: string) {
    const jwtSecret = this.config.get<string>('JWT_SECRET');
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!jwtSecret || !refreshSecret) {
      throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be configured');
    }

    const payload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: this.config.get('JWT_EXPIRY', '1h'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: this.config.get('JWT_REFRESH_EXPIRY', '30d'),
    });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
      return this.signTokens(payload.sub as string, payload.email as string);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Exchange a BetterAuth session (via cookie) for JWT tokens.
   * Called by GET /auth/session-token in the controller.
   * Finds the user in DB by email (from BetterAuth session) and issues tokens.
   */
  async sessionToken(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('User not found');
    return this.signTokens(user.id, user.email);
  }
}

// ── Utility: parse browser + OS from User-Agent string ────────────────────────
function parseDevice(ua: string): string {
  if (!ua) return 'Unknown device';

  let browser = 'Unknown browser';
  if (ua.includes('Edg/'))       browser = 'Microsoft Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Chrome/'))  browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';

  let os = 'Unknown OS';
  if (ua.includes('Windows NT'))    os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Android'))  os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux'))    os = 'Linux';

  return `${browser} on ${os}`;
}
