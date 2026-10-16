import { Controller, Get, Post, Put, Param, Body, Delete, ParseUUIDPipe, UseGuards, HttpCode } from '@nestjs/common';
import { BoardsService } from './boards.service.js';
import { UpsertBoardDto } from './dto/upsert-board.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OrderDto } from './dto/board-order.dto.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @HttpCode(200)
  @Get('boards')
  async loadAll(@CurrentUser() user: User){
    return await this.boardsService.loadAll(user.id)
  }

  @HttpCode(200)
  @Put('boards/:id')
  async upsertBoard(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() upsertBoardDto: UpsertBoardDto){
    return await this.boardsService.upsertBoard(user.id, id, upsertBoardDto)
  }

  @HttpCode(204)
  @Put('board-order')
  async updateOrder(@CurrentUser() user: User, @Body() orderDto: OrderDto){
    return await this.boardsService.setOrder(user.id, orderDto)
  }

  @HttpCode(200)
  @Post('boards/:id/trash')
  async trashBoard(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() upsertBoardDto: UpsertBoardDto){
    return await this.boardsService.trashBoard(user.id, id, upsertBoardDto)
  }

  @HttpCode(200)
  @Post('boards/:id/restore')
  async restoreBoard(@CurrentUser() user: User, @Param('id') id: string){
    return await this.boardsService.restoreBoard(user.id, id)
  }

  @HttpCode(204)
  @Delete('boards/:id')
  async purgeBoard(@Param('id') id:string){
    return
  }

  @HttpCode(204)
  @Delete('trash')
  async clearTrash(){
    return
  }

  @HttpCode(201)
  @Post('boards/import')
  async importBoard(){
    return
  }
}
