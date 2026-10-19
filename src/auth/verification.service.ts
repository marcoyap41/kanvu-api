import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';
import { MailService } from '../mail/mail.service.js';

/**
 * Email verification for new accounts (deferred registration).
 *
 * A sign-up is NOT written to PostgreSQL. It waits in Redis until the user clicks the link in the email,
 * so typos, bots and abandoned sign-ups never become rows in the users table: Redis simply expires them.
 *
 * Redis keys (email is always lowercased):
 *   verify:pending:<email>    JSON { name, passwordHash, tokenHash }   TTL PENDING_TTL  the sign-up waiting for verification
 *   verify:token:<tokenHash>  <email>                                  TTL LINK_TTL     the link currently valid for that sign-up
 *   verify:cooldown:<email>   "1"                                      TTL COOLDOWN     minimum gap between two emails
 *   verify:sends:<email>      counter                                  TTL WINDOW       emails sent to this address in the window
 *   verify:ip:<ip>            counter                                  TTL WINDOW       emails triggered by this IP in the window
 *
 * Only a SHA-256 of the token is stored, so a Redis leak doesn't expose usable links.
 */
const LINK_TTL = 30 * 60;           // a link works for 30 minutes
const PENDING_TTL = 24 * 60 * 60;   // an unverified sign-up is kept for 24 hours (a login in that time can resend the link)
const COOLDOWN = 60;                // at most one email per address per minute
const WINDOW = 60 * 60;             // rate-limit window: 1 hour
const MAX_SENDS_PER_EMAIL = 5;      // emails per address per window
const MAX_SENDS_PER_IP = 20;        // emails per IP per window (stops one client from spraying many addresses)

export type PendingSignup = { name: string | null; passwordHash: string; tokenHash: string };

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class VerificationService {
  readonly linkTtlMinutes = LINK_TTL / 60;
  private readonly frontendUrl: string;

  constructor(@Inject(REDIS) private readonly redis: Redis, private readonly mail: MailService, config: ConfigService) {
    this.frontendUrl = config.getOrThrow<string>('FRONTEND_URL').replace(/\/+$/, '');
  }

  // ---- Sign-up waiting in Redis ----

  async getPending(email: string): Promise<PendingSignup | null> {
    const raw = await this.redis.get(this.k.pending(email));
    return raw ? (JSON.parse(raw) as PendingSignup) : null;
  }

  // Saves (or replaces) the pending sign-up and emails a fresh link. The caller must call reserveSend() first.
  async createPending(email: string, data: { name: string | null; passwordHash: string }, ip: string) {
    await this.issueAndSend(email, data, ip);
  }

  // Emails a new link for an existing pending sign-up. Returns false if there is none (expired or never registered).
  async resend(email: string, ip: string): Promise<boolean> {
    const pending = await this.getPending(email);
    if (!pending) return false;
    await this.reserveSend(email, ip);
    await this.issueAndSend(email, { name: pending.name, passwordHash: pending.passwordHash }, ip);
    return true;
  }

  /**
   * Redeems a link. Single use: the token key is deleted atomically (GETDEL), so a replay or a second click fails.
   * Returns the sign-up data so the caller can create the user, then call finish(email).
   */
  async consume(token: string): Promise<{ email: string; name: string | null; passwordHash: string }> {
    const invalid = () => new BadRequestException('This verification link is invalid or has expired. Sign up again or request a new link.');
    if (!token || typeof token !== 'string' || token.length > 200) throw invalid();

    const tokenHash = sha256(token);
    const email = await this.redis.getdel(this.k.token(tokenHash));
    if (!email) throw invalid();

    const pending = await this.getPending(email);
    if (!pending || pending.tokenHash !== tokenHash) throw invalid(); // an older link, replaced by a newer one
    return { email, name: pending.name, passwordHash: pending.passwordHash };
  }

  // The account now exists in PostgreSQL: drop everything Redis held for this sign-up
  async finish(email: string) {
    await this.redis.del(this.k.pending(email), this.k.cooldown(email), this.k.sends(email));
  }

  // ---- Rate limiting (protects the Resend quota and users' inboxes) ----

  /**
   * Reserves one email send for this address and IP, or throws 429 with { retryAfter } (seconds).
   * Checks, in order: the per-address cooldown, the per-address hourly cap, the per-IP hourly cap.
   */
  async reserveSend(email: string, ip: string) {
    const cooldownKey = this.k.cooldown(email);
    const gotSlot = await this.redis.set(cooldownKey, '1', 'EX', COOLDOWN, 'NX');
    if (!gotSlot) throw this.tooMany(await this.redis.ttl(cooldownKey));

    const sends = await this.bump(this.k.sends(email));
    if (sends > MAX_SENDS_PER_EMAIL) throw this.tooMany(await this.redis.ttl(this.k.sends(email)));

    const fromIp = await this.bump(this.k.ip(ip));
    if (fromIp > MAX_SENDS_PER_IP) throw this.tooMany(await this.redis.ttl(this.k.ip(ip)));
  }

  // ---- Internals ----

  private async issueAndSend(email: string, data: { name: string | null; passwordHash: string }, ip: string) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);

    // Invalidate the previous link, if any, so only the newest email works
    const previous = await this.getPending(email);
    const tx = this.redis.multi();
    if (previous) tx.del(this.k.token(previous.tokenHash));
    tx.set(this.k.pending(email), JSON.stringify({ ...data, tokenHash } satisfies PendingSignup), 'EX', PENDING_TTL);
    tx.set(this.k.token(tokenHash), email, 'EX', LINK_TTL);
    await tx.exec();

    // The token travels in the URL fragment (#...): it is never sent to a server, logged, or leaked in a Referer header.
    // The frontend reads it and POSTs it to /auth/verify-email. Using POST also means email scanners that prefetch links can't burn it.
    const link = `${this.frontendUrl}/#verify=${token}`;
    try {
      await this.mail.sendVerificationEmail(email, link, this.linkTtlMinutes);
    } catch (e) {
      await this.release(email, ip); // the email didn't go out: don't charge it against the user's limits
      throw e;
    }
  }

  // Gives back a reservation made by reserveSend() (used when the email could not be sent)
  private async release(email: string, ip: string) {
    await this.redis.multi().del(this.k.cooldown(email)).decr(this.k.sends(email)).decr(this.k.ip(ip)).exec();
  }

  // INCR with the window expiry set on the first hit
  private async bump(key: string) {
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, WINDOW);
    return n;
  }

  private tooMany(ttlSeconds: number) {
    const retryAfter = Math.max(1, ttlSeconds);
    const wait = retryAfter < 60 ? `${retryAfter} seconds` : `${Math.ceil(retryAfter / 60)} minutes`;
    return new HttpException(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: `Too many verification emails. Please try again in ${wait}.`, retryAfter },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private readonly k = {
    pending: (email: string) => `verify:pending:${email}`,
    token: (tokenHash: string) => `verify:token:${tokenHash}`,
    cooldown: (email: string) => `verify:cooldown:${email}`,
    sends: (email: string) => `verify:sends:${email}`,
    ip: (ip: string) => `verify:ip:${ip}`,
  };
}

