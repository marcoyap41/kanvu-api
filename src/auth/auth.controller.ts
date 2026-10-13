import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { UpdateAuthDto } from './dto/update-auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @Post() // /auth/register

  // @Post() // /auth/login

  // @Post() // /auth/refresh

  // @Post() // /auth/logout

  // @Get() // /auth/google

  // @Get() // /auth/github
}
