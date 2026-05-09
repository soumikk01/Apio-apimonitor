import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

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
