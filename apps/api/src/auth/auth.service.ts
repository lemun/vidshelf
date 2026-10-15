import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import type { Env } from '../config/env';
import { toPublicUser } from '../users/public-user';
import type { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import type { AccessTokenPayload, ClientMeta, RefreshTokenPayload, Session } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './schemas/refresh-token.schema';

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Compared against when the email is unknown, so both failure paths cost one bcrypt check. */
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly config: ConfigService<Env, true>,
    @InjectModel(RefreshToken.name) private readonly refreshTokens: Model<RefreshToken>,
  ) {
    this.dummyHash = bcrypt.hash(
      'timing-equaliser',
      this.config.get('BCRYPT_ROUNDS', { infer: true }),
    );
  }

  async register(dto: RegisterDto, meta: ClientMeta = {}): Promise<Session> {
    if (await this.users.existsByEmailOrUsername(dto.email, dto.username)) {
      throw new ConflictException('An account with this email or username already exists');
    }
    const passwordHash = await bcrypt.hash(
      dto.password,
      this.config.get('BCRYPT_ROUNDS', { infer: true }),
    );
    const user = await this.users.create({
      username: dto.username,
      email: dto.email,
      passwordHash,
    });
    return this.issueSession(user, meta);
  }

  async login(dto: LoginDto, meta: ClientMeta = {}): Promise<Session> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueSession(user, meta);
  }

  /**
   * Exchanges a refresh token for a new access + refresh pair. The presented token is consumed
   * atomically, so it works exactly once. Presenting an already-consumed token means it leaked
   * (or a client raced itself), and every session of that user is revoked.
   */
  async refresh(refreshToken: string | undefined, meta: ClientMeta = {}): Promise<Session> {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = hashToken(refreshToken);
    const now = new Date();
    const consumed = await this.refreshTokens
      .findOneAndUpdate(
        { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
        { $set: { revokedAt: now } },
      )
      .exec();

    if (!consumed) {
      const known = await this.refreshTokens.findOne({ tokenHash }).exec();
      if (known?.revokedAt) {
        this.logger.warn(`Refresh token reuse detected for user ${known.user.toString()}`);
        await this.revokeAllForUser(known.user.toString());
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (consumed.user.toString() !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.users.findById(consumed.user);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.issueSession(user, meta);
  }

  /** Revokes the given refresh token if it is still active. Always succeeds (idempotent). */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.refreshTokens
      .updateOne(
        { tokenHash: hashToken(refreshToken), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokens
      .updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }
    return { user: toPublicUser(user) };
  }

  private async issueSession(user: UserDocument, meta: ClientMeta): Promise<Session> {
    const accessTtl = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const refreshTtl = this.config.get('JWT_REFRESH_TTL_SECONDS', { infer: true });

    const accessPayload: AccessTokenPayload = { sub: user._id.toString(), username: user.username };
    const refreshPayload: RefreshTokenPayload = { sub: user._id.toString(), jti: randomUUID() };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: accessTtl,
        algorithm: 'HS256',
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: refreshTtl,
        algorithm: 'HS256',
      }),
    ]);

    const refreshTokenExpiresAt = new Date(Date.now() + refreshTtl * 1000);
    await this.refreshTokens.create({
      user: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
      userAgent: meta.userAgent?.slice(0, 256),
      ip: meta.ip,
    });

    return {
      user: toPublicUser(user),
      accessToken,
      accessTokenExpiresIn: accessTtl,
      refreshToken,
      refreshTokenExpiresAt,
    };
  }
}
