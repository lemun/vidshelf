import type { PublicUser } from '../users/public-user';

export interface AccessTokenPayload {
  sub: string;
  username: string;
}

export interface RefreshTokenPayload {
  sub: string;
  /** The refresh session (token family) this token belongs to. */
  sid: string;
  /** The session's rotation counter when this token was issued. */
  gen: number;
  /** Random id so two tokens issued in the same second never collide. */
  jti: string;
}

export interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

/** What the service returns; the controller moves `refreshToken` into an httpOnly cookie. */
export interface Session {
  user: PublicUser;
  accessToken: string;
  accessTokenExpiresIn: number;
  /**
   * Absent only for a refresh answered inside the concurrent-refresh grace window: the request that
   * rotated the token has already set the new cookie, so this response leaves the cookie alone.
   */
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
}

/** A session with a newly minted refresh token (sign-in, sign-up and a real rotation). */
export type IssuedSession = Session & { refreshToken: string; refreshTokenExpiresAt: Date };

export type AuthResponse = Omit<Session, 'refreshToken' | 'refreshTokenExpiresAt'>;
