import { BadRequestException, Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserSettings } from '../users/entities/user.entity.js';
import { Repository } from 'typeorm';
import { Wallpaper } from './entities/wallpaper.entity.js';
import { Express } from 'express';
import { detectImageType } from './image-type.js';
import type { EntityManager } from 'typeorm';

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(User) private userRepository: Repository<User>, @InjectRepository(Wallpaper) private wallpaperRepository: Repository<Wallpaper>){}

  async get(userId: number){
    const user = await this.userRepository.findOne({where:{id: userId}, select:{id:true, settings:true}});
    return {settings: user?.settings ?? {}};
  }

  async update(userId: number, updateSettingsDto: UpdateSettingsDto){
    const user = await this.userRepository.findOne({where:{id: userId}, select:{id:true, settings:true}});
    if(!user) throw new NotFoundException('User not found!');

    const update: Record<string, unknown> = {...(user.settings ?? {})}
    for(const [key, value] of Object.entries(updateSettingsDto)){
      if(value==undefined) continue;
      if(value==null) delete update[key];
      else update[key]=value;
    }
    user.settings = update as UserSettings;
    await this.userRepository.save(user)
    return {settings: user.settings}
  }

  async findWallpaper(userId: number){
    return await this.wallpaperRepository.findOne({where:{userId}})
  }

  async updateWallpaper(userId: number, file?: Express.Multer.File){
    if(!file) throw new BadRequestException('file is required');
    const mimeType = detectImageType(file.buffer);
    if(!mimeType) throw new UnsupportedMediaTypeException('Only JPEG, PNG, and WebP images are accepted');    
    
    return this.wallpaperRepository.manager.transaction(async (m) =>{
      const wallpaperRepository = m.getRepository(Wallpaper);
      await wallpaperRepository.save(wallpaperRepository.create({userId, data:file.buffer, mimeType}));
      const saved = await wallpaperRepository.findOneOrFail({where: {userId}, select: {userId: true, updatedAt: true}});
      const wallpaperVersion = saved.updatedAt.toISOString();
      await this.setVersion(m, userId, wallpaperVersion)
      return { wallpaperVersion }
    })
  }

  async deleteWallpaper(userId: number){
    await this.wallpaperRepository.manager.transaction(async (m)=>{
      await m.getRepository(Wallpaper).delete({userId});
      await this.setVersion(m, userId, null);
    })
  }

  private async setVersion(m: EntityManager, userId: number, version: string | null){
    const users = m.getRepository(User);
    const user = await users.findOne({where:{id: userId}, select:{id:true, settings:true}});
    if (!user) throw new NotFoundException();
    const settings = {...(user.settings ?? {})};
    if(version) settings.wallpaperVersion = version;
    else delete settings.wallpaperVersion;
    user.settings = settings;
    await users.save(user);
  }
}
