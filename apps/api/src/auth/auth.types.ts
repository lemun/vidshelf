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
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export type AuthResponse = Omit<Session, 'refreshToken' | 'refreshTokenExpiresAt'>;
