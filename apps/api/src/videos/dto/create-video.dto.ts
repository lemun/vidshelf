import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateVideoDto {
    @ApiProperty({ example: 'My First Video', maxLength: 120 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    title!: string;

    @ApiPropertyOptional({ example: 'Short decsription of the video', maxLength: 5000 })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @ApiPropertyOptional({ description: 'Media file location (Minio)' })
    @IsOptional()
    @IsUrl()
    sourceUrl?: string;

    @ApiPropertyOptional({ description: 'Thumbnail URL' })
    @IsOptional()
    @IsUrl()
    thumbnailUrl?: string;
}
