import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    title: 'Email',
    name: 'email',
    description: 'The email of a user',
    example: 'test@test.com',
    required: true,
    type: String,
    format: 'email',
    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    minLength: 5,
    maxLength: 255,
    uniqueItems: true,
  })
  @IsEmail()
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  email: string;

  @ApiProperty({
    title: 'Password',
    name: 'password',
    description: 'The password of a user',
    example: 'Abcd1234#',
    required: true,
    type: String,
    format: 'password',
    pattern:
      '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$',
    minLength: 8,
    maxLength: 20,
    uniqueItems: true,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  password: string;
}
