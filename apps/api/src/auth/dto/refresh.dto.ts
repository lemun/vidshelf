import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
    @ApiPropertyOptional({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Refresh token (optional if using cookie)' })
    @IsOptional()
    @IsString()
    refreshToken?: string;
}
