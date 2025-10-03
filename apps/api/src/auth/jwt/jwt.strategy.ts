import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { environments } from 'src/environments/environments';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: environments.jwtSecret,
    });
  }

  async validate(payload: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { email } = payload;
    if (!email) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const existingUser = await this.usersService.getUserByEmail(email);

    if (!existingUser) {
      throw new UnauthorizedException('User not found');
    }

    return {
      _id: existingUser._id,
      email: existingUser.email,
      bio: existingUser.bio,
      avatarUrl: existingUser.avatarUrl,
    };
  }
}
