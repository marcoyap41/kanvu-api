import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { SettingsController } from './settings.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { Wallpaper } from './entities/wallpaper.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Wallpaper])],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
