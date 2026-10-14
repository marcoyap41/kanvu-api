import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { Repository } from 'typeorm';

type newUser = { name?: string | null; email: string; hashedPassword: string | null };

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private userRepository: Repository<User>){}

  //dev db test. prod should only add from /auth/register 
  async addUserDev(data: newUser){
    const newUser = this.userRepository.create({
      name: data.name ?? null,
      email: data.email,
      password: data.hashedPassword
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

  async findByEmailWithPassword(email: string){
    return await this.userRepository.findOne({
      where: { email: email},
      select: { id: true, name: true, email: true, password: true}
    })
  }
}
