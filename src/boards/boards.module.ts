import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service.js';
import { BoardsController } from './boards.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm'
import { Board } from './entities/board.entity.js'
import { User } from './entities/user.entity.js'


@Module({
  imports: [TypeOrmModule.forFeature([Board,User])],
  controllers: [BoardsController],
  providers: [BoardsService],
})
export class BoardsModule {}
