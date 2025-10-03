import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { environments } from 'src/environments/environments';

@Injectable()
export class CustomJwtService {
  constructor(private readonly jwtService: JwtService) {}

  generateToken(payload: { email: string }): string {
    const jwtExpiry = environments.jwtAccessTokenTtl;
    return this.jwtService.sign(payload, {
      secret: environments.jwtSecret,
      expiresIn: jwtExpiry,
    });
  }

  verifyToken(token: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return this.jwtService.verify(token, {
        secret: environments.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
