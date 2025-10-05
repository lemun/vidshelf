import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from 'express';
import { Public } from "../common/decorators";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtRefreshGuard } from "./guards/jwt-refresh.guard";
import { RequestUser } from "./interfaces/request-user";


@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) {}

    @Public()
    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    register(@Body() dto: RegisterDto) {
        return this.auth.register(dto);
    }

    @Public()
    @Post('login')
    @ApiOperation({ summary: 'Login and get access/refresh tokens' })
    login(@Body() dto: LoginDto) {
        return this.auth.login(dto);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post('logout')
    @ApiOperation({ summary: 'Logout and revoke refresh token' })
    logout(@Req() req: Request & { user: RequestUser }) {
        if (!req.user) {
            throw new Error('User not found in request');
        }
        return this.auth.logout(req.user.userId);
    }

    @Public()
    @UseGuards(JwtRefreshGuard)
    @Post('refresh')
    @ApiOperation({ summary: 'Rotate refresh token using JwtRefreshGuard' })
    refresh(@Req() req: Request & { user: RequestUser }) {
        if (!req.user) {
            throw new Error('User not found in request');
        }
        if (!req.user.refreshToken) {
            throw new Error('Refresh token not found in request');
        }
        return this.auth.rotateRefreshToken(req.user.refreshToken);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('me')
    @ApiOperation({ summary: 'Get current user profile' })
    me(@Req() req: Request & { user: RequestUser }) {
        if (!req.user) {
            throw new Error('User not found in request');
        }
        return this.auth.getProfile(req.user.userId);
    }
}
