import { PrimaryColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Entity, JoinColumn } from 'typeorm';
import { User } from './user.entity.js'

type JsonObject = Record<string, unknown>;

@Entity()
export class Board {
    @PrimaryColumn('uuid')
    uuid: string;

    @ManyToOne(()=>User, (user)=>user.boards, {onDelete: 'CASCADE'}) //typeorm decorator to create manytoone relation from this entity to User, with user.boards as the property that will be the foreign key column
    @JoinColumn({name: 'userId'}) //typeorm decorator that sets the name of the column in the boards table. Without it, TypeORM builds the name from the property name plus Id, which gives userIdId
    userId: User;

    @Column({type:"varchar", length:100})
    name: string;

    @Column('jsonb', {nullable:true})
    tasks: JsonObject[];

    @Column('jsonb', {nullable:true})
    columns: JsonObject[];

    @Column()
    position: number;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    lastModified: Date;

    @DeleteDateColumn({type: 'timestamptz'})
    deletedAt: Date | null;
}
