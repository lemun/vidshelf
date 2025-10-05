import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_SECRET, JWT_ACCESS_STRATEGY } from '../interfaces/constants';
import { JwtPayload } from '../interfaces/jwt-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JWT_ACCESS_STRATEGY) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: ACCESS_TOKEN_SECRET
        })
    }

    validate(payload: JwtPayload) {
        return {
            userId: payload.sub,
            email: payload.email,
            username: payload.username
        };
    }
}
