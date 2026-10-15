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
import type {
  AccessTokenPayload,
  ClientMeta,
  IssuedSession,
  RefreshTokenPayload,
  Session,
} from './auth.types';
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
   * once, and a revocation (reuse detection or logout) that lands at any point before that update
   * makes it fail: the replacement is then never stored and never returned.
   *
   * Two tabs share one cookie, so they can send the same token at once. The loser presents the
   * token the winner has just consumed. If that happens within REFRESH_GRACE_MS of the rotation,
   * once, on a live session, it gets a new access token and no refresh token (the winner's response
   * sets the cookie). Any other spent token means it leaked: that session and every other active
   * session of the user are revoked.
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
    const tokenHash = hashToken(refreshToken);
    const now = new Date();

    const rotated = await this.sessions
      .updateOne(
        {
          _id: payload.sid,
          user: payload.sub,
          tokenHash,
          generation: payload.gen,
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        {
          $set: {
            tokenHash: hashToken(next.refreshToken),
            generation: payload.gen + 1,
            expiresAt: next.refreshTokenExpiresAt,
            previousTokenHash: tokenHash,
            rotatedAt: now,
            graceUsedAt: null,
            userAgent: meta.userAgent?.slice(0, 256),
            ip: meta.ip,
          },
        },
      )
      .exec();
    if (rotated.matchedCount === 1) {
      return next;
    }

    // Lost a race with a concurrent refresh of the same token? Also one conditional update, so
    // it fails if the session is revoked first, and can be used once per rotation.
    const graced = await this.sessions
      .updateOne(
        {
          _id: payload.sid,
          user: payload.sub,
          previousTokenHash: tokenHash,
          generation: payload.gen + 1,
          rotatedAt: { $gt: new Date(now.getTime() - REFRESH_GRACE_MS) },
          graceUsedAt: null,
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        { $set: { graceUsedAt: now } },
      )
      .exec();
    if (graced.matchedCount === 1) {
      // Access token only: the winning refresh's response sets the cookie.
      return {
        user: next.user,
        accessToken: next.accessToken,
        accessTokenExpiresIn: next.accessTokenExpiresIn,
      };
    }

    await this.revokeAllIfReused(payload, tokenHash, now);
    throw invalidRefreshToken();
  }

  /**
   * Ends the session the presented refresh token belongs to. The token is identified by its
   * signature, session id and generation, not by looking up its hash, so logout still works when
   * a concurrent refresh has just replaced it: the current token or the one just before it are
   * both accepted. Anything else is ignored. Always succeeds (idempotent).
   */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    let payload: RefreshTokenPayload;
    try {
      payload = await this.verifyRefreshToken(refreshToken);
    } catch {
      return;
    }
    await this.sessions
      .updateOne(
        {
          _id: payload.sid,
          user: payload.sub,
          generation: { $gte: payload.gen, $lte: payload.gen + 1 },
          revokedAt: null,
        },
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
  private async issueSession(user: UserDocument, meta: ClientMeta): Promise<IssuedSession> {
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
  private async signSession(user: UserDocument, sid: string, gen: number): Promise<IssuedSession> {
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

  /**
   * A validly signed token from an older generation of its session was already spent: revoke
   * every session of the user. Exception: the token consumed by the session's last rotation,
   * presented within the grace window after the session was ended (a tab that raced a sign-out);
   * that only fails.
   */
  private async revokeAllIfReused(
    payload: RefreshTokenPayload,
    tokenHash: string,
    now: Date,
  ): Promise<void> {
    const session = await this.sessions.findById(payload.sid).exec();
    if (!session || session.user.toString() !== payload.sub || payload.gen >= session.generation) {
      return;
    }
    const racedSignOut =
      session.revokedAt !== null &&
      session.previousTokenHash === tokenHash &&
      session.rotatedAt !== null &&
      session.rotatedAt.getTime() > now.getTime() - REFRESH_GRACE_MS;
    if (racedSignOut) return;
    this.logger.warn(`Refresh token reuse detected for user ${payload.sub}`);
    await this.revokeAllForUser(payload.sub);
  }
}

/**
 * How long after a rotation the token it consumed may still be presented once (by another tab
 * that sent the same cookie at the same time) without being treated as reuse.
 */
export const REFRESH_GRACE_MS = 10_000;

const invalidRefreshToken = () => new UnauthorizedException('Invalid refresh token');
