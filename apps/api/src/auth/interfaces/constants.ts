import { environments } from "src/environments/environments";

export const JWT_ACCESS_STRATEGY = 'jwt';
export const JWT_REFRESH_STRATEGY = 'jwt-refresh';

export const ACCESS_TOKEN_TTL = environments.jwtAccessTokenTtl;
export const REFRESH_TOKEN_TTL = environments.jwtRefreshTokenTtl;

export const ACCESS_TOKEN_SECRET = environments.jwtAccessTokenSecret;
export const REFRESH_TOKEN_SECRET = environments.jwtRefreshTokenSecret;
