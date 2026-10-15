import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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

  @ApiProperty({ example: 'correct-horse-42', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt ignores bytes after 72
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password must contain at least one letter and one number',
  })
  password!: string;
}
