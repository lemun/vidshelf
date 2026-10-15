import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Min } from 'class-validator';

export const VIDEO_TYPES = ['video/mp4', 'video/webm'] as const;
export const THUMBNAIL_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export class CreateUploadDto {
  @ApiProperty({ enum: ['video', 'thumbnail'] })
  @IsIn(['video', 'thumbnail'])
  kind!: 'video' | 'thumbnail';

  @ApiProperty({ example: 'video/mp4', enum: [...VIDEO_TYPES, ...THUMBNAIL_TYPES] })
  @IsString()
  @IsIn([...VIDEO_TYPES, ...THUMBNAIL_TYPES])
  contentType!: string;

  @ApiProperty({ example: 1048576, description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
