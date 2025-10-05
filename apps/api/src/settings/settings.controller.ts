import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
    constructor(private readonly settings: SettingsService) {}

    @Get()
    @ApiOperation({ summary: 'Get current user settings' })
    get(@Req() req: any) {
        return this.settings.get(req.user.userId);
    }

    @Patch()
    @ApiOperation({ summary: 'Update current user settings' })
    update(@Req() req: any, @Body() dto: UpdateSettingsDto) {
        return this.settings.update(req.user.userId, dto);
    }

    @Patch('password')
    @ApiOperation({ summary: 'Change account password' })
    changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
        return this.settings.changePassword(req.user.userId, dto);
    }

    @Patch('email')
    @ApiOperation({ summary: 'Change account email' })
    changeEmail(@Req() req: any, @Body() dto: ChangeEmailDto) {
        return this.settings.changeEmail(req.user.userId, dto);
    }
}
