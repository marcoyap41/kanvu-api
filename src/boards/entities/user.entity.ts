import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Board } from "./board.entity.js";

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToMany(()=>Board, (board)=>board.userId)
    boards: Board[];

    @Column({type:'varchar', length:50, nullable:true})
    name: string | null;

    @Column({unique: true})
    email: string;
    
    @Column({type:"varchar", length:60, nullable:true, select:false})
    password: string | null;
}