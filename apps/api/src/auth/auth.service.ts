import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import type { Env } from '../config/env';
import { toPublicUser } from '../users/public-user';
import type { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import type { AccessTokenPayload, ClientMeta, RefreshTokenPayload, Session } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PASSWORD_TOO_LONG_MESSAGE, passwordFitsBcrypt } from './password';
import { RefreshSession } from './schemas/refresh-session.schema';

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
    @InjectModel(RefreshSession.name) private readonly sessions: Model<RefreshSession>,
  ) {
    this.dummyHash = bcrypt.hash(
      'timing-equaliser',
      this.config.get('BCRYPT_ROUNDS', { infer: true }),
    );
  }

  async register(dto: RegisterDto, meta: ClientMeta = {}): Promise<Session> {
    // Also enforced by RegisterDto; repeated here so no caller can store a silently truncated hash.
    if (!passwordFitsBcrypt(dto.password)) {
      throw new BadRequestException(PASSWORD_TOO_LONG_MESSAGE);
    }
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
   * Exchanges a refresh token for a new access + refresh pair.
   *
   * The presented token must be the current token of a live session. The check and the storing of
   * the replacement are ONE conditional update of the session document, so the token works exactly
   * once, and a revocation that lands at any point before that update makes it fail: the
   * replacement is then never stored and never returned.
   *
   * Presenting a token from an older generation of its session means it was already spent, so it
   * leaked (or a client raced itself): that session and every other active session of the user are
   * revoked.
   */
  async refresh(refreshToken: string | undefined, meta: ClientMeta = {}): Promise<Session> {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const payload = await this.verifyRefreshToken(refreshToken);

    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw invalidRefreshToken();
    }
    const next = await this.signSession(user, payload.sid, payload.gen + 1);

    const rotated = await this.sessions
      .updateOne(
        {
          _id: payload.sid,
          user: payload.sub,
          tokenHash: hashToken(refreshToken),
          generation: payload.gen,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        },
        {
          $set: {
            tokenHash: hashToken(next.refreshToken),
            generation: payload.gen + 1,
            expiresAt: next.refreshTokenExpiresAt,
            userAgent: meta.userAgent?.slice(0, 256),
            ip: meta.ip,
          },
        },
      )
      .exec();

    if (rotated.matchedCount !== 1) {
      await this.revokeAllIfReused(payload);
      throw invalidRefreshToken();
    }
    return next;
  }

  /** Ends the session whose current refresh token this is. Always succeeds (idempotent). */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.sessions
      .updateOne(
        { tokenHash: hashToken(refreshToken), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  /** Revokes every active session of the user. Each session is revoked in one atomic update. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.sessions
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

  /** Starts a new refresh session (token family) for a fresh sign-in. */
  private async issueSession(user: UserDocument, meta: ClientMeta): Promise<Session> {
    const sessionId = new Types.ObjectId();
    const session = await this.signSession(user, sessionId.toString(), 0);
    await this.sessions.create({
      _id: sessionId,
      user: user._id,
      tokenHash: hashToken(session.refreshToken),
      generation: 0,
      expiresAt: session.refreshTokenExpiresAt,
      userAgent: meta.userAgent?.slice(0, 256),
      ip: meta.ip,
    });
    return session;
  }

  /** Signs an access token and a refresh token for generation `gen` of session `sid`. */
  private async signSession(user: UserDocument, sid: string, gen: number): Promise<Session> {
    const accessTtl = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const refreshTtl = this.config.get('JWT_REFRESH_TTL_SECONDS', { infer: true });

    const accessPayload: AccessTokenPayload = { sub: user._id.toString(), username: user.username };
    const refreshPayload: RefreshTokenPayload = {
      sub: user._id.toString(),
      sid,
      gen,
      jti: randomUUID(),
    };

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

    return {
      user: toPublicUser(user),
      accessToken,
      accessTokenExpiresIn: accessTtl,
      refreshToken,
      refreshTokenExpiresAt: new Date(Date.now() + refreshTtl * 1000),
    };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    let payload: Partial<RefreshTokenPayload>;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        algorithms: ['HS256'],
      });
    } catch {
      throw invalidRefreshToken();
    }
    const { sub, sid, gen, jti } = payload;
    if (
      typeof sub !== 'string' ||
      typeof sid !== 'string' ||
      typeof jti !== 'string' ||
      !isValidObjectId(sub) ||
      !isValidObjectId(sid) ||
      !Number.isSafeInteger(gen) ||
      (gen as number) < 0
    ) {
      throw invalidRefreshToken();
    }
    return { sub, sid, gen: gen as number, jti };
  }

  /** A validly signed token from an older generation of its session was already spent: revoke. */
  private async revokeAllIfReused(payload: RefreshTokenPayload): Promise<void> {
    const session = await this.sessions.findById(payload.sid).exec();
    if (session && session.user.toString() === payload.sub && payload.gen < session.generation) {
      this.logger.warn(`Refresh token reuse detected for user ${payload.sub}`);
      await this.revokeAllForUser(payload.sub);
    }
  }
}

const invalidRefreshToken = () => new UnauthorizedException('Invalid refresh token');
