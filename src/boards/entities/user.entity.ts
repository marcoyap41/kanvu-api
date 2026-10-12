import { Column, CreateDateColumn, Entity, OneToMany, OneToOne, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { Board } from "./board.entity.js";
import { Wallpaper } from "./wallpaper.entity.js";
import { OAuthAccount } from "./oauthaccount.entity.js";
import { RefreshToken } from "./refreshtoken.entity.js";

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type:'varchar', length:50, nullable:true})
    name: string | null;

    @Column({unique: true})
    email: string; //lowercase di service sebelum disave
    
    @Column({type:"varchar", length:255, nullable:true, select:false})
    password: string | null;

    @Column({type:"jsonb", default: () => "'{}'"})
    settings: Record<string, unknown>;

    @CreateDateColumn({type:'timestamptz'})
    createdAt: Date;

    @OneToMany(()=>Board, (board)=>board.user)
    boards: Board[];

    @OneToMany(()=>OAuthAccount, (account)=>account.user)
    oauthAccounts: Relation<OAuthAccount[]>

    @OneToMany(()=>RefreshToken, (token)=>token.user)
    refreshTokens: Relation<RefreshToken[]>;

    @OneToOne(()=>Wallpaper, (wallpaper)=>(wallpaper.user))
    wallpaper: Relation<Wallpaper> | null;
}