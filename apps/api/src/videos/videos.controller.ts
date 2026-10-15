import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateUploadDto } from './dto/create-upload.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { ListVideosQuery } from './dto/list-videos.query';
import { UpdateVideoDto } from './dto/update-video.dto';
import { VideosService } from './videos.service';

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Post('uploads')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get a presigned POST to upload a video or thumbnail directly to MinIO',
    description:
      'POST a multipart form to `url` with every entry of `fields` followed by the file as `file`. Then call POST /videos with the returned `key`.',
  })
  createUpload(@CurrentUser() user: AuthUser, @Body() dto: CreateUploadDto) {
    return this.videos.createUploadTarget(user.userId, dto);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish an uploaded video' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVideoDto) {
    return this.videos.create(user.userId, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List videos, newest first, or by relevance when `q` is given' })
  list(@Query() query: ListVideosQuery) {
    return this.videos.list(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'A video with a presigned stream URL (valid for one hour)' })
  @ApiNotFoundResponse()
  findOne(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user?: AuthUser) {
    return this.videos.findOne(id, user?.userId);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit title or description (uploader only)' })
  @ApiForbiddenResponse()
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateVideoDto,
  ) {
    return this.videos.update(id, user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a video and its stored files (uploader only)' })
  @ApiForbiddenResponse()
  remove(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.videos.remove(id, user.userId);
  }

  @Public()
  @Post(':id/views')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Count a play' })
  registerView(@Param('id', ParseObjectIdPipe) id: string) {
    return this.videos.registerView(id);
  }

  @Put(':id/like')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like (idempotent)' })
  like(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.videos.like(id, user.userId);
  }

  @Delete(':id/like')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove your like (idempotent)' })
  unlike(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.videos.unlike(id, user.userId);
  }
}
