import { Controller, Post, Body, HttpCode, HttpStatus, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verification.dto.js';
import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie} from './refresh-cookie.js';

// Client IP for rate limiting (main.ts enables 'trust proxy' so this is the real client behind Render's proxy)
const clientIp = (req: Request) => req.ip ?? req.socket.remoteAddress ?? 'unknown';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  // @Post() // /auth/refresh
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

  // @Post() // /auth/logout
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: Request,){
    return this.authService.logout(req.cookies?.[REFRESH_COOKIE])
  }

  // @Get() // /auth/google

  // @Get() // /auth/github
}
