import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    title: 'Email',
    name: 'email',
    description: 'The email of the user',
    example: 'test@test.com',
    required: true,
    type: String,
    format: 'email',
  })
  @IsEmail()
  @IsString()
  @IsOptional()
  email?: string;
}
