import { ArrayMaxSize, IsArray, IsUUID } from "class-validator";

export class OrderDto {
    @IsArray()
    @ArrayMaxSize(500)
    @IsUUID('all', {each:true})
    ids: string[];
}