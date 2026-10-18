import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateSettingsDto{
    @IsOptional()
    @IsIn(['black', 'grey', 'white'])
    theme?: 'black' | 'grey' | 'white' | null;

    @IsOptional() 
    @IsIn(['comfortable', 'compact', 'dense'])
    density?: 'comfortable' | 'compact' | 'dense' | null;

    @IsOptional() 
    @IsInt() 
    @IsIn([3, 4, 5])
    columnLayout?: 3 | 4 | 5 | null;

    @IsOptional() 
    @IsIn(['columns', 'lanes'])
    layout?: 'columns' | 'lanes' | null;

    @IsOptional() 
    @IsBoolean() 
    headerBlur?: boolean | null;
    
    @IsOptional() 
    @IsBoolean() 
    glassLanes?: boolean | null;
    
    @IsOptional() 
    @IsBoolean() 
    glassCards?: boolean | null;
    
    @IsOptional() 
    @IsBoolean() 
    autosave?: boolean | null;

    @IsOptional() 
    @IsInt() 
    @Min(20) 
    @Max(95)
    glassOpacity?: number | null;

    @IsOptional() 
    @IsInt() 
    @Min(0) 
    @Max(30)
    headerBlurAmount?: number | null;

    @IsOptional() 
    @IsInt() 
    @Min(0) 
    @Max(30)
    stageBlurAmount?: number | null;
}
