import { BadRequestException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { createHash, randomBytes } from 'node:crypto';
import { REDIS } from '../redis/redis.module.js';

export type OAuthProvider = 'google' | 'github';

export interface OAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  name: string | null;
}

const STATE_TTL_SECONDS = 10 * 60; // 10 minutes
const TICKET_TTL_SECONDS = 60;     // 60 seconds

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class OAuthService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  get frontendUrl(): string {
    return (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5500').replace(/\/+$/, '');
  }

  private callbackUrl(provider: OAuthProvider, defaultBaseUrl: string): string {
    const envKey = provider === 'google' ? 'GOOGLE_CALLBACK_URL' : 'GITHUB_CALLBACK_URL';
    const explicit = this.config.get<string>(envKey)?.trim();
    if (explicit) return explicit;
    return `${defaultBaseUrl.replace(/\/+$/, '')}/auth/${provider}/callback`;
  }

  async getAuthorizationUrl(provider: OAuthProvider, defaultBaseUrl: string): Promise<string> {
    const state = randomBytes(24).toString('base64url');
    await this.redis.set(`oauth:state:${ sha256(state) }`, provider, 'EX', STATE_TTL_SECONDS);

    const redirectUri = this.callbackUrl(provider, defaultBaseUrl);

    if (provider === 'google') {
      const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
      if (!clientId) {
        throw new ServiceUnavailableException('Google sign-in is not configured on the server.');
      }
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    const clientId = this.config.get<string>('GITHUB_CLIENT_ID')?.trim();
    if (!clientId) {
      throw new ServiceUnavailableException('GitHub sign-in is not configured on the server.');
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async authenticateCallback(
    provider: OAuthProvider,
    code: string | undefined,
    state: string | undefined,
    defaultBaseUrl: string,
  ): Promise<OAuthProfile> {
    if (!code || !state) {
      throw new BadRequestException('Missing OAuth authorization code or state.');
    }

    const storedProvider = await this.redis.getdel(`oauth:state:${sha256(state)}`);
    if (storedProvider !== provider) {
      throw new UnauthorizedException('OAuth session expired or invalid. Please try signing in again.');
    }

    const redirectUri = this.callbackUrl(provider, defaultBaseUrl);
    if (provider === 'google') {
      return this.verifyGoogleCode(code, redirectUri);
    }
    return this.verifyGithubCode(code, redirectUri);
  }

  private async verifyGoogleCode(code: string, redirectUri: string): Promise<OAuthProfile> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('Google sign-in is not configured on the server.');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      throw new UnauthorizedException('Failed to exchange Google authorization code.');
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new UnauthorizedException('Google did not return an access token.');
    }

    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      throw new UnauthorizedException('Failed to fetch Google user profile.');
    }

    const profile = (await userRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };

    if (!profile.sub || !profile.email) {
      throw new BadRequestException('Google account did not provide an email address.');
    }
    if (profile.email_verified === false) {
      throw new UnauthorizedException('Your Google email address is not verified.');
    }

    return {
      provider: 'google',
      providerUserId: String(profile.sub),
      email: profile.email.trim().toLowerCase(),
      name: profile.name?.trim().slice(0, 50) || null,
    };
  }

  private async verifyGithubCode(code: string, redirectUri: string): Promise<OAuthProfile> {
    const clientId = this.config.get<string>('GITHUB_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('GITHUB_CLIENT_SECRET')?.trim();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('GitHub sign-in is not configured on the server.');
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      throw new UnauthorizedException('Failed to exchange GitHub authorization code.');
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      throw new UnauthorizedException('GitHub did not return an access token.');
    }

    const ghHeaders = {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Kanvu-API',
    };

    const [userRes, emailsRes] = await Promise.all([
      fetch('https://api.github.com/user', { headers: ghHeaders }),
      fetch('https://api.github.com/user/emails', { headers: ghHeaders }),
    ]);

    if (!userRes.ok) {
      throw new UnauthorizedException('Failed to fetch GitHub user profile.');
    }

    const ghUser = (await userRes.json()) as {
      id?: number | string;
      login?: string;
      name?: string | null;
      email?: string | null;
    };

    if (!ghUser.id) {
      throw new BadRequestException('Invalid GitHub user profile.');
    }

    let email: string | null = null;
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primaryVerified = emails.find((e) => e.primary && e.verified);
      const anyVerified = emails.find((e) => e.verified);
      email = (primaryVerified ?? anyVerified)?.email ?? null;
    }

    if (!email && ghUser.email) {
      email = ghUser.email;
    }

    if (!email) {
      throw new BadRequestException('Your GitHub account does not have a verified email address.');
    }

    const rawName = (ghUser.name || ghUser.login || '').trim();
    return {
      provider: 'github',
      providerUserId: String(ghUser.id),
      email: email.trim().toLowerCase(),
      name: rawName ? rawName.slice(0, 50) : null,
    };
  }

  // Short-lived, single-use ticket so the frontend can exchange it for an access token + first-party refresh cookie
  async createExchangeTicket(userId: number): Promise<string> {
    const ticket = randomBytes(32).toString('base64url');
    await this.redis.set(`oauth:ticket:${sha256(ticket)}`, String(userId), 'EX', TICKET_TTL_SECONDS);
    return ticket;
  }

  async consumeExchangeTicket(ticket: string): Promise<number> {
    if (!ticket || typeof ticket !== 'string') {
      throw new UnauthorizedException('Invalid OAuth ticket.');
    }
    const rawUserId = await this.redis.getdel(`oauth:ticket:${sha256(ticket)}`);
    const userId = rawUserId ? Number(rawUserId) : NaN;
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('OAuth sign-in ticket expired or already used.');
    }
    return userId;
  }
}

