import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { Repository } from 'typeorm';

type newUser = { name?: string | null; email: string; hashedPassword: string | null };

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private userRepository: Repository<User>){}

  async addUser(data: newUser){
    const newUser = this.userRepository.create({
      name: data.name ?? null,
      email: data.email,
      password: data.hashedPassword
    })

    return this.userRepository.save(newUser);
  };

  // Creates a verified user (called by /auth/verify-email once the email link was clicked)
  async create(data: newUser){
    return this.userRepository.save(this.userRepository.create({
      name: data.name ?? null,
      email: data.email,
      password: data.hashedPassword
    }));
  }
  
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

  async findEmail(email: string){
    return await this.userRepository.findOne({where: {email}, select:{email: true}})
  }

  async findByEmailWithPassword(email: string){
    return await this.userRepository.findOne({
      where: {email},
      select: { id: true, name: true, email: true, password: true}
    })
  }
}
