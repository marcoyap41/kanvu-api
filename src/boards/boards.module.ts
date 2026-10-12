import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service.js';
import { BoardsController } from './boards.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm'
import { Board } from './entities/board.entity.js'
import { User } from './entities/user.entity.js'
import { OAuthAccount } from './entities/oauthaccount.entity.js';
import { RefreshToken } from './entities/refreshtoken.entity.js';
import { Wallpaper } from './entities/wallpaper.entity.js';


@Module({
  imports: [TypeOrmModule.forFeature([Board,User,OAuthAccount,RefreshToken,Wallpaper])],
  controllers: [BoardsController],
  providers: [BoardsService],
})
export class BoardsModule {}
