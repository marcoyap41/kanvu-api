import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service.js';
import { BoardsController } from './boards.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm'
import { Board } from './entities/board.entity.js'
import { User } from '../users/entities/user.entity.js'
import { OAuthAccount } from '../auth/entities/oauthaccount.entity.js';
import { RefreshToken } from '../auth/entities/refreshtoken.entity.js';
import { Wallpaper } from '../settings/entities/wallpaper.entity.js';


@Module({
  imports: [TypeOrmModule.forFeature([Board,User,OAuthAccount,RefreshToken,Wallpaper])],
  controllers: [BoardsController],
  providers: [BoardsService],
})
export class BoardsModule {}
