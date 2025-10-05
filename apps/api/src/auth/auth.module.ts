import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema';

@Module({
    imports: [
        PassportModule,
        JwtModule.register({
            secret: process.env.JWT_ACCESS_TOKEN_SECRET,
            signOptions: { expiresIn: process.env.JWT_ACCESS_TOKEN_TTL },
        }),
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: RefreshToken.name, schema: RefreshTokenSchema },
        ]),
        forwardRef(() => UsersModule),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, JwtRefreshStrategy, JwtRefreshGuard],
    exports: [AuthService],
})

export class AuthModule {}
