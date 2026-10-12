import { IsString, IsNotEmpty, IsObject, MaxLength, IsArray} from 'class-validator'

type JsonObject = Record<string, unknown>;

export class CreateBoardDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsArray()
    @IsObject({each:true})
    tasks: JsonObject[];
    
    @IsArray()
    @IsObject()
    columns: JsonObject[]; 
}
