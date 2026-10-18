import { Controller, Get, Post, Body, Patch, Param, Delete, Put, UseGuards, Res, StreamableFile, NotFoundException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}
  
  @Get()
  get(@CurrentUser() user: User){
    return this.settingsService.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: User, @Body() updateSettingsDto: UpdateSettingsDto){
    return this.settingsService.update(user.id, updateSettingsDto);
  }

  @Get('wallpaper')
  async loadWallpaper(@CurrentUser() user: User, @Res({passthrough:true}) res: Response){
    const w = await this.settingsService.findWallpaper(user.id);
    if(!w) throw new NotFoundException('No wallpaper set');
    res.set({
      'Content-Type': w.mimeType,
      'Cache-Control': 'private, no-cache',
      'X-Content-Type-Options': 'nosniff',
    }); 
    return new StreamableFile(w.data)
  }

  @Put('wallpaper')
  @UseInterceptors(FileInterceptor('file', {limits: {fileSize: 4 * 1024 * 1024, files:1}}))
  updateWallpaper(@CurrentUser() user: User, @UploadedFile() file?: Express.Multer.File){
    return this.settingsService.updateWallpaper(user.id, file);
  }

  @Delete('wallpaper')
  deleteWallpaper(@CurrentUser() user: User){
    return this.settingsService.deleteWallpaper(user.id)
  }
}
