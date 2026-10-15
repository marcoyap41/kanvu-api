import { Injectable, Body, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UsersService } from '../users/users.service.js';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refreshtoken.entity.js';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { REFRESH_TTL_MS } from './refresh-cookie.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// used when the email doesn't exist, so the response time doesn't reveal which emails are registered
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class AuthService {
  constructor(private usersService : UsersService, private jwtService: JwtService, @InjectRepository(RefreshToken) private refreshToken: Repository<RefreshToken>){}

  async register(registerDto: RegisterDto){
    const name = registerDto.name ?? null;

    const email = registerDto.email.trim().toLowerCase();

    const hashedPassword = await bcrypt.hash(registerDto.password, 10)
    
    const user = await this.usersService.addUserDev({name, email, hashedPassword})
    
    return await this.startSession(user)
  }

  async login(loginDto: LoginDto){
    const email = loginDto.email.trim().toLowerCase();

    const user = await this.usersService.findByEmailWithPassword(loginDto.email)
    const ok = await bcrypt.compare(loginDto.password, user?.password ?? DUMMY_HASH)

    if(!user || !ok) throw new UnauthorizedException('Invalid email or password')

    return await this.startSession(user)
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
