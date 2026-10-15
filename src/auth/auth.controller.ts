import { Controller, Post, Body, HttpCode, HttpStatus, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie} from './refresh-cookie.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @Post() // /auth/register
  @HttpCode(HttpStatus.OK)
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Res({passthrough:true}) res: Response){
    const { refreshToken, body } = await this.authService.register(registerDto);
    setRefreshCookie(res, refreshToken)
    return body;
  }

  // @Post() // /auth/login
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({passthrough:true}) res: Response){
    const { refreshToken, body } = await this.authService.login(loginDto)
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
