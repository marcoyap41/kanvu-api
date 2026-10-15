import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { User } from './entities/user.entity.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

type newUser = { name?: string | null; email: string; hashedPassword: string | null };

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  //dev db test
  @Post()
  async addUserDev(@Body() data: newUser){
    const newUser = await this.usersService.addUserDev(data)
    return {
      message: `Dev \n New user added to db`,
      newUser
    }
  }

  //dev get db test
  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserDev(){
    return this.usersService.findAll()
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async findMe(@CurrentUser() user: User){
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    }
  }
}
