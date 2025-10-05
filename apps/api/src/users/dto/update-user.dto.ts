import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
    @ApiPropertyOptional({ example: 'shaisinai' })
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(20)
    username?: string;

    @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
    @IsOptional()
    @IsUrl()
    avatarUrl?: string;

    @ApiPropertyOptional({ example: 'https://example.com/banner.png' })
    @IsOptional()
    @IsUrl()
    bannerUrl?: string;

    @ApiPropertyOptional({ example: 'Short bio up to ~300 chars' })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    about?: string;
}
