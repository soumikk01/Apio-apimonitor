import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { otpTemplate, OtpType } from './templates/otp.template';
import { welcomeTemplate } from './templates/welcome.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null = null;
  private readonly from: string;
  private readonly appName = 'Apio';
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    const host = config.get<string>('SMTP_HOST', 'smtp.resend.com');
    const port = config.get<number>('SMTP_PORT', 465);

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465 (SSL), false for 587 (STARTTLS)
        auth: { user, pass },
      });
      this.enabled = true;
      this.logger.log(`Email service ready (${host}:${port} as ${user})`);
    } else {
      this.enabled = false;
      this.logger.warn(
        'Email service DISABLED — SMTP_USER / SMTP_PASS not set in .env.',
      );
    }

    this.from = config.get('EMAIL_FROM', 'noreply@apio.one');
  }

  // ── Internal send helper ────────────────────────────────────────────────────
  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.enabled || !this.transporter) return;
    const info = await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
    });
    this.logger.log(`Email sent to ${to} → messageId: ${info.messageId}`);
  }

  // ── OTP / Verification Code ────────────────────────────────────────────────
  async sendOtp(to: string, otp: string, type: OtpType): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`[email disabled] would send OTP (${type}) to ${to}`);
      return;
    }
    const subjects: Record<OtpType, string> = {
      'sign-in': `Your ${this.appName} sign-in code`,
      'email-verification': `Verify your ${this.appName} account`,
      'forget-password': `Your ${this.appName} password reset code`,
    };
    try {
      await this.send(to, subjects[type], otpTemplate(otp, type));
    } catch (err) {
      this.logger.error(`Failed to send OTP email to ${to}`, err);
      throw err;
    }
  }

  // ── Welcome Email ──────────────────────────────────────────────────────────
  async sendWelcome(to: string, name: string): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`[email disabled] would send welcome email to ${to}`);
      return;
    }
    const dashUrl =
      this.config.get('FRONTEND_URL', 'https://apio.one') + '/projects';
    try {
      await this.send(
        to,
        `Welcome to ${this.appName}! 🎉`,
        welcomeTemplate(name, dashUrl),
      );
    } catch (err) {
      // Welcome email is non-critical — log but don't throw
      this.logger.warn(
        `Failed to send welcome email to ${to}: ${(err as Error).message}`,
      );
    }
  }
}
