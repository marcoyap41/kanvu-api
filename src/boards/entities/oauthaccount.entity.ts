import { Column, Entity, JoinColumn, PrimaryGeneratedColumn, ManyToOne, type Relation, Unique, Index } from "typeorm";
import { User } from "./user.entity.js";

@Entity('oauth_accounts')
@Unique(['provider', 'providerUserId'])
export class OAuthAccount{
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type:'varchar', length:20})
    provider: string;

    @Column({type:'varchar', length:255})
    providerUserId: string;

    @Index()
    @Column()
    userId: number;

    @ManyToOne(()=>User, (user)=>(user.oauthAccounts), {onDelete: 'CASCADE'})
    @JoinColumn({name: 'userId'})
    user: Relation<User>;
}