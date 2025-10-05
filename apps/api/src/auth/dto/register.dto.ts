import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'shaisinai', description: 'Unique username' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  username!: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;


  @ApiProperty({ example: 'StrongPass123!', description: 'Password (min 8 chars, must include letters & numbers)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\s]{8,}$/, {
    message: 'Password must contain letters and numbers',
  })
  password!: string;
}
