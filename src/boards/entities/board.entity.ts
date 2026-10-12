import { PrimaryColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Entity, JoinColumn, Index, type Relation } from 'typeorm';
import { User } from './user.entity.js'

type JsonObject = Record<string, unknown>;

@Entity()
@Index(['userId', 'deletedAt'])
export class Board {
    @PrimaryColumn('uuid')
    id: string;

    @Column()
    userId: number;

    @ManyToOne(()=>User, (user)=>user.boards, {onDelete: 'CASCADE'}) 
    @JoinColumn({name: 'userId'}) 
    user: Relation<User>; 

    @Column({type:"varchar", length:100})
    name: string;

    @Column({type:'jsonb', default: ()=>"'[]'"})
    tasks: JsonObject[];

    @Column({type:'jsonb', default: ()=>"'[]'"})
    columns: JsonObject[];

    @Column({type: 'int'})
    position: number;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    lastModified: Date;

    @DeleteDateColumn({type: 'timestamptz'})
    deletedAt: Date | null;
}
