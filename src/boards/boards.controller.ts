import { Controller, Get, Post, Body, Delete } from '@nestjs/common';
import { BoardsService } from './boards.service.js';
import { CreateBoardDto } from './dto/create-board.dto.js';
import { UpdateBoardDto } from './dto/update-board.dto.js';

@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

}
