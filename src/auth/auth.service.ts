import { Injectable, Body, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UsersService } from '../users/users.service.js';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt'

// used when the email doesn't exist, so the response time doesn't reveal which emails are registered
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class AuthService {
  constructor(private usersService : UsersService, private jwtService: JwtService){}

  async register(@Body() registerDto: RegisterDto){
    const name = registerDto.name ?? null;

    const email = registerDto.email.trim().toLowerCase();

    const hashedPassword = await bcrypt.hash(registerDto.password, 10)
    
    const user = await this.usersService.addUserDev({name, email, hashedPassword})
    
    return {
      id: user.id,
      name: user.name ?? null,
      email: user.email
    }
  }

  async login(@Body() loginDto: LoginDto){
    const email = loginDto.email.trim().toLowerCase();

    const user = await this.usersService.findByEmailWithPassword(loginDto.email)
    const ok = await bcrypt.compare(loginDto.password, user?.password ?? DUMMY_HASH)

    if(!user || !ok) throw new UnauthorizedException('Invalid email or password')

    return {
      id: user.id,
      accessToken: this.jwtService.sign({sub: user.id})
    }
  }
}
