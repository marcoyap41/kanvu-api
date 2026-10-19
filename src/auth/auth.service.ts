import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UsersService } from '../users/users.service.js';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refreshtoken.entity.js';
import { OAuthAccount } from './entities/oauthaccount.entity.js';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { REFRESH_TTL_MS } from './refresh-cookie.js';
import { VerificationService } from './verification.service.js';
import { OAuthService, type OAuthProfile } from './oauth.service.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// used when the email doesn't exist, so the response time doesn't reveal which emails are registered
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class AuthService {
  constructor(
    private usersService : UsersService,
    private jwtService: JwtService,
    @InjectRepository(RefreshToken) private refreshToken: Repository<RefreshToken>,
    @InjectRepository(OAuthAccount) private oauthAccount: Repository<OAuthAccount>,
    private verification: VerificationService,
    private oauth: OAuthService,
  ){}

  // Step 1 of sign-up: nothing is written to PostgreSQL. The sign-up waits in Redis and a link is emailed.
  async register(registerDto: RegisterDto, ip: string){
    const name = registerDto.name?.trim() || null;
    const email = normalizeEmail(registerDto.email);

    if (await this.usersService.findByEmailWithPassword(email)) throw new ConflictException('An account with this email already exists. Sign in instead.');

    await this.verification.reserveSend(email, ip); // rate limit BEFORE the expensive bcrypt hash and the email
    const passwordHash = await bcrypt.hash(registerDto.password, 10);
    await this.verification.createPending(email, { name, passwordHash }, ip);

    return { status: 'verification_sent', email, expiresInMinutes: this.verification.linkTtlMinutes };
  }

  // Step 2 of sign-up: the link was clicked. Create the user and sign them in.
  async verifyEmail(token: string){
    const { email, name, passwordHash } = await this.verification.consume(token);

    if (await this.usersService.findByEmailWithPassword(email)) {
      await this.verification.finish(email);
      throw new ConflictException('This email is already verified. Sign in instead.');
    }

    let user;
    try {
      user = await this.usersService.create({ name, email, hashedPassword: passwordHash });
    } catch (e: any) {
      if (e?.code === '23505') throw new ConflictException('This email is already verified. Sign in instead.'); // unique violation (race)
      throw e;
    }
    await this.verification.finish(email);
    return await this.startSession(user);
  }

  // "Resend the email" button. Same answer whether or not a sign-up is pending, so it can't be used to probe emails.
  async resendVerification(rawEmail: string, ip: string){
    const email = normalizeEmail(rawEmail);
    await this.verification.resend(email, ip);
    return { status: 'verification_sent', email, expiresInMinutes: this.verification.linkTtlMinutes };
  }

  async login(loginDto: LoginDto, ip: string){
    const email = normalizeEmail(loginDto.email);

    const user = await this.usersService.findByEmailWithPassword(email)
    if (user) {
      const ok = await bcrypt.compare(loginDto.password, user.password ?? DUMMY_HASH)
      if (!ok || !user.password) throw new UnauthorizedException('Invalid email or password')
      return await this.startSession(user)
    }

    // No account yet: maybe a sign-up that was never verified. With the right password, resend the link (rate limited).
    const pending = await this.verification.getPending(email);
    const ok = await bcrypt.compare(loginDto.password, pending?.passwordHash ?? DUMMY_HASH);
    if (!pending || !ok) throw new UnauthorizedException('Invalid email or password')

    let retryAfter: number | undefined;
    try {
      await this.verification.resend(email, ip);
    } catch (e) {
      if (!(e instanceof HttpException) || e.getStatus() !== HttpStatus.TOO_MANY_REQUESTS) throw e;
      retryAfter = (e.getResponse() as { retryAfter?: number }).retryAfter;
    }
    throw new ForbiddenException({
      statusCode: HttpStatus.FORBIDDEN,
      code: 'EMAIL_NOT_VERIFIED',
      email,
      retryAfter,
      message: retryAfter === undefined
        ? `Your email is not verified yet. We sent a new verification link to ${email}.`
        : `Your email is not verified yet. Use the link we already sent to ${email}.`,
    });
  }

  // Finds or creates the user for a verified Google/GitHub OAuth profile, links oauth_accounts, and starts a session + exchange ticket
  async loginWithOAuth(profile: OAuthProfile) {
    const email = normalizeEmail(profile.email);
    const name = profile.name?.trim().slice(0, 50) || null;

    let user: { id: number; email: string; name: string | null } | null = null;

    const existingLink = await this.oauthAccount.findOne({
      where: { provider: profile.provider, providerUserId: profile.providerUserId },
    });

    if (existingLink) {
      user = await this.usersService.findMe(existingLink.userId);
    }

    if (!user) {
      const existingUser = await this.usersService.findByEmailWithPassword(email);
      if (existingUser) {
        user = existingUser;
      } else {
        user = await this.usersService.create({ name, email, hashedPassword: null });
      }
      await this.oauthAccount.upsert(
        {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          userId: user.id,
        },
        ['provider', 'providerUserId'],
      );
      await this.verification.finish(email);
    }

    const session = await this.startSession(user);
    const ticket = await this.oauth.createExchangeTicket(user.id);
    return { ...session, ticket };
  }

  async exchangeOAuthTicket(ticket: string) {
    const userId = await this.oauth.consumeExchangeTicket(ticket);
    const user = await this.usersService.findMe(userId);
    if (!user) throw new UnauthorizedException('User not found.');
    return await this.startSession(user);
  }

  async refresh(raw?: string){
    if (!raw) throw new UnauthorizedException('Invalid refresh token!');
    const row = await this.refreshToken.findOne({
      where: {tokenHash: sha256(raw)}
    });

    if (!row || row.expiresAt < new Date()){
      if (row) await this.refreshToken.delete(row.id);
      throw new UnauthorizedException('Invalid refresh token!');
    }

    // rotate refresh token 
    const res = await this.refreshToken.delete(row.id);
    if (!res.affected) throw new UnauthorizedException('Invalid refresh token!') //if no row deleted, res.affected === 0, meaning another request already used the token so it throws error 

    const user = await this.usersService.findMe(row.userId)
    if (!user) throw new UnauthorizedException('Invalid refresh token!')
    return await this.startSession(user);
  }

  private async startSession(user: { id:number, email:string, name:string|null}){
    const refreshToken = randomBytes(48).toString('base64url');
    await this.refreshToken.save(this.refreshToken.create({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    }));
    return{
      refreshToken,
      body: { accessToken: this.jwtService.sign({sub: user.id}), user: { id: user.id, email: user.email, name: user.name}}
    }
  }

  async logout(raw?: string){
    if (raw) await this.refreshToken.delete({tokenHash:sha256(raw)})
  }
}
