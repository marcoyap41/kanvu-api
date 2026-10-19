import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { OAuthService, type OAuthProvider } from './oauth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verification.dto.js';
import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie} from './refresh-cookie.js';

// Client IP for rate limiting (main.ts enables 'trust proxy' so this is the real client behind Render's proxy)
const clientIp = (req: Request) => req.ip ?? req.socket.remoteAddress ?? 'unknown';

// Derives the backend's public base URL (e.g. https://kanvu-api.onrender.com) when explicit callback env vars are omitted
const requestBaseUrl = (req: Request) => `${req.protocol}://${req.get('host')}`;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
  ) {}

  // /auth/register -> 202 { status: 'verification_sent', email, expiresInMinutes }. No session yet.
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Req() req: Request){
    return this.authService.register(registerDto, clientIp(req));
  }

  // /auth/verify-email { token } -> 200 { accessToken, user } + refresh cookie
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto, @Res({passthrough:true}) res: Response){
    const { refreshToken, body } = await this.authService.verifyEmail(dto.token);
    setRefreshCookie(res, refreshToken);
    return body;
  }

  // /auth/resend-verification { email } -> 202 (always the same answer), 429 { retryAfter } when rate limited
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto, @Req() req: Request){
    return this.authService.resendVerification(dto.email, clientIp(req));
  }

  // /auth/login. 403 { code: 'EMAIL_NOT_VERIFIED' } for a sign-up that hasn't been verified yet
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: Request, @Res({passthrough:true}) res: Response){
    const { refreshToken, body } = await this.authService.login(loginDto, clientIp(req))
    setRefreshCookie(res, refreshToken)
    return body;
  }

  // /auth/refresh
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({passthrough:true}) res: Response){
    try{
      const { refreshToken , body } = await this.authService.refresh(req.cookies?.[REFRESH_COOKIE]); 
      setRefreshCookie(res, refreshToken);
      return body;
    }
    catch (e){
      clearRefreshCookie(res);
      throw e;
    }
  }

  // /auth/logout
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: Request, @Res({passthrough:true}) res: Response){
    clearRefreshCookie(res);
    return this.authService.logout(req.cookies?.[REFRESH_COOKIE])
  }

  // /auth/google -> redirects to Google OAuth consent screen
  @Get('google')
  async google(@Req() req: Request, @Res() res: Response) {
    return this.startOAuth('google', req, res);
  }

  // /auth/google/callback -> exchanges code, sets refresh cookie, redirects to FRONTEND_URL/#auth=success
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.finishOAuth('google', code, state, error, req, res);
  }

  // /auth/github -> redirects to GitHub OAuth authorize screen
  @Get('github')
  async github(@Req() req: Request, @Res() res: Response) {
    return this.startOAuth('github', req, res);
  }

  // /auth/github/callback -> exchanges code, sets refresh cookie, redirects to FRONTEND_URL/#auth=success
  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.finishOAuth('github', code, state, error, req, res);
  }

  // /auth/oauth/exchange { ticket } -> 200 { accessToken, user } + refresh cookie
  @HttpCode(HttpStatus.OK)
  @Post('oauth/exchange')
  async exchangeOAuthTicket(@Body('ticket') ticket: string, @Res({passthrough:true}) res: Response) {
    const { refreshToken, body } = await this.authService.exchangeOAuthTicket(ticket);
    setRefreshCookie(res, refreshToken);
    return body;
  }

  private async startOAuth(provider: OAuthProvider, req: Request, res: Response) {
    try {
      const url = await this.oauthService.getAuthorizationUrl(provider, requestBaseUrl(req));
      return res.redirect(url);
    } catch (e: any) {
      const msg = e?.message || `Could not start ${provider} sign-in.`;
      return res.redirect(`${this.oauthService.frontendUrl}/#auth_error=${encodeURIComponent(msg)}`);
    }
  }

  private async finishOAuth(
    provider: OAuthProvider,
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
    req: Request,
    res: Response,
  ) {
    if (error) {
      const msg = error === 'access_denied' ? 'Sign-in was cancelled.' : `OAuth error: ${error}`;
      return res.redirect(`${this.oauthService.frontendUrl}/#auth_error=${encodeURIComponent(msg)}`);
    }
    try {
      const profile = await this.oauthService.authenticateCallback(provider, code, state, requestBaseUrl(req));
      const { refreshToken, ticket } = await this.authService.loginWithOAuth(profile);
      setRefreshCookie(res, refreshToken);
      return res.redirect(`${this.oauthService.frontendUrl}/#auth=success&ticket=${encodeURIComponent(ticket)}`);
    } catch (e: any) {
      const msg = e?.message || `Could not complete ${provider} sign-in.`;
      return res.redirect(`${this.oauthService.frontendUrl}/#auth_error=${encodeURIComponent(msg)}`);
    }
  }
}
