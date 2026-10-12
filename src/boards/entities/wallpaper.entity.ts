import { Entity, JoinColumn, OneToOne, PrimaryColumn, Column, UpdateDateColumn, type Relation } from "typeorm";
import { User } from "./user.entity.js";

@Entity()
export class Wallpaper{
    @PrimaryColumn()
    userId: User;

    @OneToOne(()=>User, (user)=>user.wallpaper)
    @JoinColumn({name: 'userId'})
    user: Relation<User>;

    @Column({type: 'bytea', select:false})
    data: Buffer;

    @Column({type: 'varchar', length:50})
    mimeType: string;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;
}