import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const key = config.get<string>('RESEND_API_KEY');
    this.resend = key ? new Resend(key) : null;
    // Must be an address on a domain verified in Resend. 'onboarding@resend.dev' only delivers to your own Resend account email.
    this.from = config.get<string>('MAIL_FROM') ?? 'Kanvu <onboarding@resend.dev>';
  }

  async sendVerificationEmail(to: string, link: string, ttlMinutes: number) {
    if (!this.resend) {
      // Local development without a Resend key: print the link instead of sending
      this.log.warn(`RESEND_API_KEY not set. Verification link for ${to}: ${link}`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Verify your email for Kanvu',
      text: `Welcome to Kanvu!\n\nConfirm your email address to finish creating your account:\n${link}\n\nThis link expires in ${ttlMinutes} minutes. If you did not sign up for Kanvu, you can ignore this email.`,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:24px;color:#111">
          <h2 style="margin:0 0 12px">Welcome to Kanvu</h2>
          <p style="margin:0 0 20px">Confirm your email address to finish creating your account.</p>
          <a href="${link}" style="display:inline-block;padding:11px 18px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Verify email</a>
          <p style="margin:20px 0 0;font-size:13px;color:#555">This link expires in ${ttlMinutes} minutes. If you did not sign up for Kanvu, you can ignore this email.</p>
          <p style="margin:12px 0 0;font-size:12px;color:#888;word-break:break-all">${link}</p>
        </div>`,
    });

    // The Resend SDK returns errors instead of throwing
    if (error) {
      this.log.error(`Resend failed for ${to}: ${error.message}`);
      throw new ServiceUnavailableException('Could not send the verification email. Please try again later.');
    }
  }
}

