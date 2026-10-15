import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { UsersModule } from '../users/users.module.js';
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refreshtoken.entity.js';
import { OAuthAccount } from './entities/oauthaccount.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([RefreshToken, OAuthAccount]),
    UsersModule, 
    PassportModule, 
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '5m' }
      })
  })],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
