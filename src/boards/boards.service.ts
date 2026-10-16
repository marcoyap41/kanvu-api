import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UpsertBoardDto } from './dto/upsert-board.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Board } from './entities/board.entity.js';

const toBoard = (b: Board) => ({
  id: b.id, name: b.name, tasks: b.tasks, columns: b.columns, createdAt: b.createdAt, lastModified: b.lastModified
});

const toTrash = (b: Board) => ({ ...toBoard(b), deletedAt: b.deletedAt });

@Injectable()
export class BoardsService {
  constructor(@InjectRepository(Board) private boardRepository: Repository<Board>){}

  async loadAll(userId: number){
    const active = await this.boardRepository.find({where:{userId}, order:{position:'ASC', createdAt:'ASC'}});
    const trash = await this.boardRepository.find({
      where:{userId, deletedAt: Not(IsNull())}, withDeleted: true, order:{deletedAt:'DESC'}
    });
    
    return {boards: active.map(toBoard), order: active.map((b) => b.id), trash: trash.map(toTrash)}
  }

  async upsertBoard(userId: number, id: string, upsertBoardDto: UpsertBoardDto){
    const existing = await this.boardRepository.findOne({where:{id}, withDeleted:true});
    if(existing && existing.userId !== userId) throw new NotFoundException('Board not found!');
    if(existing?.deletedAt) throw new ConflictException('Board is in the trash!');
    
    const board = existing ?? this.boardRepository.create({
      id,
      userId,
      position: await this.nextPosition(userId)
    });
    board.name = upsertBoardDto.name;
    board.tasks = upsertBoardDto.tasks;
    board.columns = upsertBoardDto.columns;
    return toBoard(await this.boardRepository.save(board));    
  }

  private async nextPosition(userId: number, boardRepository: Repository<Board> = this.boardRepository){
    const row = await boardRepository.createQueryBuilder('b').withDeleted()
      .select('MAX(b.position)', 'max').where('b.userId = :userId', {userId}).getRawOne();
    return Number(row?.max ?? -1) + 1;    
  }
}
