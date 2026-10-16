import { Controller, Get, Post, Put, Param, Body, Delete, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { BoardsService } from './boards.service.js';
import { UpsertBoardDto } from './dto/upsert-board.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('boards')
@UseGuards(JwtAuthGuard)
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get()
  async loadAll(@CurrentUser() user: User){
    return this.boardsService.loadAll(user.id)
  }

  @Put(':id')
  async upsertBoard(@Param('id', ParseUUIDPipe) id: string, @Body() upsertBoardDto: UpsertBoardDto, @CurrentUser() user: User){
    return this.boardsService.upsertBoard(user.id, id, upsertBoardDto)
  }

  @Put('board-order')
  async updateOrder(){
    return 
  }

  @Post(':id/trash')
  async trashBoard(@Param('id') id: string){
    return
  }

  @Post(':id/restore')
  async restoreBoard(@Param('id') id: string){
    return
  }

  @Delete(':id')
  async purgeBoard(@Param('id') id:string){
    return
  }

  @Delete('trash')
  async clearTrash(){
    return
  }

  @Post('import')
  async importBoard(){
    return
  }
}
