import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";


export class UpdateVideoDto {
    @ApiPropertyOptional({ maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    title?: string;

    @ApiPropertyOptional({ maxLength: 5000 })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsUrl()
    thumbnailUrl?: string
}
