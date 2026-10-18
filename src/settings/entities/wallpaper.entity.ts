import { Entity, JoinColumn, OneToOne, PrimaryColumn, Column, UpdateDateColumn, type Relation } from "typeorm";
import { User } from "../../users/entities/user.entity.js";

@Entity('wallpapers')
export class Wallpaper{
    @PrimaryColumn()
    userId: number;

    @OneToOne(()=>User, (user)=>user.wallpaper, {onDelete: 'CASCADE'})
    @JoinColumn({name: 'userId'})
    user: Relation<User>;

    @Column({type: 'bytea'})
    data: Buffer;

    @Column({type: 'varchar', length:20})
    mimeType: string;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;
}