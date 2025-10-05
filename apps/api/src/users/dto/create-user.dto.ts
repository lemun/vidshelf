import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

export class createUserDto {
    @ApiProperty({ example: 'shaisinai', description: 'Unique username' })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(20)
    username!: string;

    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'StrongPass123!', description: 'Password (min 8 chars, must include letters & numbers)' })
    @IsOptional()
    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\s]{8,}$/, {
        message: 'Password must contain letters and numbers',
    })
    password?: string;

    @ApiProperty({ example: 'https://example.com/avatar.png', required: false })
    @IsOptional()
    @IsUrl()
    avatarUrl?: string;

    @ApiProperty({ example: 'https://example.com/banner.png', required: false })
    @IsOptional()
    @IsUrl()
    bannerUrl?: string;

    @ApiProperty({ example: 'About me...', required: false, maxLength: 300 })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    about?: string;
}
