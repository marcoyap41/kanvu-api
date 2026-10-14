import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @Post() // /auth/register
  @HttpCode(HttpStatus.OK)
  @Post('register')
  async register(@Body() registerDto: RegisterDto){
    return await this.authService.register(registerDto)
  }

  // @Post() // /auth/login
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto){
    return await this.authService.login(loginDto)
  }


  // @Post() // /auth/refresh

  // @Post() // /auth/logout

  // @Get() // /auth/google

  // @Get() // /auth/github
}
