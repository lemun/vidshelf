import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { environments } from 'src/environments/environments';
import { UsersModule } from 'src/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CustomJwtService } from './jwt/jwt.service';
import { JwtStrategy } from './jwt/jwt.strategy';
import { ResetToken, ResetTokenSchema } from './models/resettokens.model';
import { ResetTokenRepository } from './repositories/resettoken.repository';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: environments.jwtSecret,
        signOptions: {
          expiresIn: environments.jwtAccessTokenTtl,
        },
      }),
    }),
    MongooseModule.forFeature([
      { name: ResetToken.name, schema: ResetTokenSchema },
    ]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, CustomJwtService, ResetTokenRepository],
  exports: [AuthService],
})
export class AuthModule {}
