import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { FitsBcrypt } from '../password';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'demo_user', minLength: 3, maxLength: 24 })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[A-Za-z0-9_.-]+$/, {
    message: 'username may only contain letters, numbers, dots, dashes and underscores',
  })
  username!: string;

  @ApiProperty({ example: 'demo@example.com' })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'correct-horse-42',
    minLength: 8,
    description: 'At most 72 bytes in UTF-8 (bcrypt ignores anything longer)',
  })
  @IsString()
  @MinLength(8)
  @FitsBcrypt()
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password must contain at least one letter and one number',
  })
  password!: string;
}
