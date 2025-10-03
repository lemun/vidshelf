import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    title: 'Email',
    name: 'email',
    description: 'The email of the user',
    example: 'test@test.com',
    required: true,
    type: String,
    format: 'email',
  })
  @IsEmail({}, { message: 'Invalid e-mail format' })
  @IsString({ message: 'Email must be a string' })
  @IsNotEmpty({ message: 'Email is required' })
  readonly email: string;

  @ApiProperty({
    title: 'Password',
    name: 'password',
    description: 'The password of the user',
    example: 'Abcd1234!',
    required: true,
    type: String,
    format: 'password',
    pattern:
      '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$',
    minLength: 8,
    maxLength: 20,
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(20, { message: 'Password must be less than 20 characters long' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number or special character',
  })
  password: string;
}
