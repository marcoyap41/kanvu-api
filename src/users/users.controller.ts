import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { User } from './entities/user.entity.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  //dev db test
  @Post()
  async addUserDev(@Body() createUserDto: CreateUserDto){
    const newUser = await this.usersService.addUserDev(createUserDto)
    return {
      message: `Dev \n New user added to db`,
      newUser
    }
  }

  //dev get db test
  @Get()
  async getUserDev(){
    return this.usersService.findAll()
  }

  @Get('me')
  async findMe(@CurrentUser() user: User){
    return {
      id: user.id,
      email: user.email,
      password: user.password
    }
  }
}
