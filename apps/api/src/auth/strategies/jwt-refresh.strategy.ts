import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_REFRESH_STRATEGY, REFRESH_TOKEN_SECRET } from '../interfaces/constants';
import { JwtPayload } from '../interfaces/jwt-payload';

function extractRefreshToken(req: Request): string | null {
    return (
        ExtractJwt.fromAuthHeaderAsBearerToken()(req) ||
        req.cookies?.refreshToken ||
        req.body?.refreshToken ||
        null
    );
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, JWT_REFRESH_STRATEGY) {
    constructor() {
        super({
            jwtFromRequest: extractRefreshToken,
            ignoreExpiration: false,
            secretOrKey: REFRESH_TOKEN_SECRET,
            passReqToCallback: true
        })
    }

    validate(req: Request, payload: JwtPayload) {
        const token = extractRefreshToken(req);
        if (!token) throw new UnauthorizedException('Missing refresh token');
        return {
            userId: payload.sub,
            email: payload.email,
            username: payload.username,
            refreshToken: token,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        }
    }
}
