import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { Repository } from 'typeorm';
import { hash } from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private userRepository: Repository<User>){}
  
  //dev db test. prod should only add from /auth/register 
  async addUserDev(createUserDto: CreateUserDto){
    const hashedPassword = await hash(createUserDto.password, 10)
    const newUser = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword
    })

    return this.userRepository.save(newUser);
  };
  
  async findAll(){
    return this.userRepository.find({
      order: {
        id: 'ASC',
      }
    })
  };

  async findMe(id: number){
    return this.userRepository.findOne({
      where: {
        id,
      }
    })
  }; 
}
