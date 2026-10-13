import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn, CreateDateColumn, ManyToOne, JoinColumn, Index, type Relation } from "typeorm";
import { User } from "../../users/entities/user.entity.js";

@Entity('refresh_tokens')
export class RefreshToken{
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column()
    userId: number;

    @ManyToOne(()=>User, (user)=>user.refreshTokens)
    @JoinColumn({name: 'userId'})
    user: Relation<User>

    @Index({unique:true})
    @Column({type:'varchar', length:64})
    tokenHash: string;

    @Column({type:'timestamptz'})
    expiresAt: Date;

    @CreateDateColumn({type:'timestamptz'})
    createdAt: Date;
}