import { Body, Controller, Delete, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-objectid.pipe';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(private readonly users: UsersService) {}

    // GET users

    @Get(':id')
    @ApiOperation({ summary: 'Get a user public profile' })
    findOne(@Param('id', ParseObjectIdPipe) id: string) {
        return this.users.findById(id);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    @ApiOperation({ summary: 'Update user profile (self)' })
    update(
        @Param('id', ParseObjectIdPipe) id: string,
        @Body() dto: UpdateUserDto,
        @Req() req: any,
    ) {
        return this.users.update(id, dto, req.user.userId);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    @ApiOperation({ summary: 'Delete user (self or admin)' })
    remove(@Param('id', ParseObjectIdPipe) id: string, @Req() req: any) {
        return this.users.remove(id, req.user.userId);
    }

    @Get(':id/videos')
    @ApiOperation({ summary: 'List videos uploaded by this user' })
    getVideos(@Param('id', ParseObjectIdPipe) id: string, @Query() q: any) {
        return this.users.getVideos(id, q);
    }

    // GET playlists
    // GET subscribers
    // GET subscriptions
    // PATCH subscribe
    // PATCH unsubscribe
    // GET history
    // DELETE history

}
