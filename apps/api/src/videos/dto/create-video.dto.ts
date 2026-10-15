import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateVideoDto {
  @ApiProperty({ example: 'Sunset timelapse', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ example: 'Shot on a phone from the balcony.', maxLength: 5000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'The `key` returned by POST /videos/uploads (kind=video)' })
  @IsString()
  @MaxLength(200)
  videoKey!: string;

  @ApiPropertyOptional({
    description: 'The `key` returned by POST /videos/uploads (kind=thumbnail)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  thumbnailKey?: string;

  @ApiPropertyOptional({
    example: 42.5,
    description: 'Duration in seconds, measured by the client',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(86_400)
  durationSeconds?: number;
}
