import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-objectid.pipe';

import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { VideosService } from './videos.service';

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
    constructor(private readonly videos: VideosService) {}

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post()
    @ApiOperation({ summary: 'Create a new video (metadata)' })
    create(@Body() dto: CreateVideoDto, @Req() req: any) {
        return this.videos.create(req.user.userId, dto);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    @ApiOperation({ summary: 'Update a video metadata (self)' })
    update(
        @Param('id', ParseObjectIdPipe) id: string,
        @Body() dto: UpdateVideoDto,
        @Req() req: any,
    ) {
        return this.videos.update(id, dto, req.user.userId);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    @ApiOperation({ summary: 'Delete a video (self or admin)' })
    remove(@Param('id', ParseObjectIdPipe) id: string, @Req() req: any) {
        return this.videos.remove(id, req.user.userId);
    }

    @Get()
    @ApiOperation({ summary: 'Get a video by id' })
    findById(@Param('id', ParseObjectIdPipe) id: string) {
        return this.videos.findById(id);
    }

    @Post(':id/views')
    @ApiOperation({ summary: 'Register a view' })
    registerView(@Param('id', ParseObjectIdPipe) id: string, @Req() req: any) {
        return this.videos.incrementView(id, req.user?.userId ?? null);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post(':id/likes')
    @ApiOperation({ summary: 'Register a like' })
    like(@Param('id', ParseObjectIdPipe) id: string, @Req() req: any) {
        return this.videos.like(id, req.user.userId);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post(':id/dislikes')
    @ApiOperation({ summary: 'Register a dislike' })
    dislike(@Param('id', ParseObjectIdPipe) id: string, @Req() req: any) {
        return this.videos.dislike(id, req.user.userId);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Delete(':id/reaction')
    @ApiOperation({ summary: 'Clear like/dislike' })
    clearReaction(@Param('id', ParseObjectIdPipe) id:string, @Req() req: any) {
        return this.videos.clearReaction(id, req.user.userId);
    }

    @Get(':id/stats')
    @ApiOperation({ summary: 'Get public stats for a video' })
    stats(@Param('id', ParseObjectIdPipe) id: string) {
        return this.videos.getStats(id);
    }
}
