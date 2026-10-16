import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UpsertBoardDto } from './dto/upsert-board.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Board } from './entities/board.entity.js';
import { OrderDto } from './dto/board-order.dto.js';

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

  async setOrder(userId: number, orderDto: OrderDto){
    const existing = await this.boardRepository.find({where:{userId}, select:{id:true}, order:{position:'ASC'}});
    const existingIds = existing.map((b) => b.id);
    const newOrder = [...new Set(orderDto.ids)].filter((id) => existingIds.includes(id)); // Set() stores unique values, removing duplicates from the array. [...new Set()] spreads back the Set objects to the arary
    const finalOrder = [...newOrder, ...existingIds.filter((id) => !newOrder.includes(id))]
    await this.boardRepository.manager.transaction(async(m) => {
      for(let i = 0; i < finalOrder.length; i++){
        await m.update(Board, {id:finalOrder[i], userId}, {position:i});
      }
    });
  }

  async trashBoard(userId: number, id: string, upsertBoardDto: UpsertBoardDto){
    const existing = await this.boardRepository.findOne({where:{id}, withDeleted:true});
    if(existing && existing.userId !== userId) throw new NotFoundException('Board not found!');
    if(existing?.deletedAt) return toTrash(existing);

    return this.boardRepository.manager.transaction(async (m) => {
      const boardRepository = m.getRepository(Board);
      const board = existing ?? boardRepository.create({id, userId, position:0});
      board.name =  upsertBoardDto.name;
      board.tasks = upsertBoardDto.tasks;
      board.columns = upsertBoardDto.columns;
      await boardRepository.save(board)
      await boardRepository.softDelete({userId, id});
      return toTrash(await boardRepository.findOneOrFail({where:{id}, withDeleted:true}));
    })
  }

  async restoreBoard(userId: number, id: string){
    const existing = await this.boardRepository.findOne({where:{id, userId}, withDeleted:true})
    if(!existing || !existing.deletedAt) throw new NotFoundException('Board is not in trash!')
    const position = await this.nextPosition(userId);
    await this.boardRepository.restore({userId, id});
    await this.boardRepository.update({id, userId}, {position});
    return toBoard(await this.boardRepository.findOneByOrFail({id}))
  }

  private async nextPosition(userId: number, boardRepository: Repository<Board> = this.boardRepository){
    const row = await boardRepository.createQueryBuilder('b').withDeleted()
      .select('MAX(b.position)', 'max').where('b.userId = :userId', {userId}).getRawOne();
    return Number(row?.max ?? -1) + 1;    
  }
}
