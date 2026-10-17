import { ArrayMaxSize, IsArray, IsDateString, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

type JsonObject = Record<string, unknown>;

export class ImportedBoardDto{
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    id: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsArray()
    @IsObject({each:true})
    tasks: JsonObject[];

    @IsArray()
    @IsObject({each:true})
    columns: JsonObject[];

    @IsOptional()
    @IsDateString()
    createdAt?: string;
}

export class ImportBoardsDto {
    @IsArray()
    @ArrayMaxSize(100)
    @ValidateNested({each:true})
    @Type(() => ImportedBoardDto)
    boards: ImportedBoardDto[]
}