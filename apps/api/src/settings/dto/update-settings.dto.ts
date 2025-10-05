import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
    @ApiPropertyOptional({ example: 'en', description: 'UI language' })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    language?: string;
}
