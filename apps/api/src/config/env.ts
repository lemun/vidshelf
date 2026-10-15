/**
 * Typed, validated environment. Validation runs once at startup (ConfigModule `validate`), so a
 * missing or malformed variable stops the process with one readable message instead of failing
 * later at first use.
 */
export interface Env {
  PORT: number;
  MONGO_URI: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  JWT_REFRESH_TTL_SECONDS: number;
  BCRYPT_ROUNDS: number;
  COOKIE_SECURE: boolean;
  AUTH_RATE_LIMIT: number;
  MINIO_ENDPOINT: string;
  MINIO_PORT: number;
  MINIO_USE_SSL: boolean;
  MINIO_ACCESS_KEY: string;
  MINIO_SECRET_KEY: string;
  MINIO_BUCKET: string;
  MINIO_PUBLIC_URL: string;
  MAX_UPLOAD_MB: number;
}

type Raw = Record<string, unknown>;

export function validateEnv(raw: Raw): Env {
  const errors: string[] = [];

  const str = (name: string, opts: { fallback?: string; minLength?: number } = {}): string => {
    const value = raw[name];
    const result = typeof value === 'string' && value.trim() !== '' ? value.trim() : opts.fallback;
    if (result === undefined) {
      errors.push(`${name} is required`);
      return '';
    }
    if (opts.minLength !== undefined && result.length < opts.minLength) {
      errors.push(`${name} must be at least ${opts.minLength} characters`);
    }
    return result;
  };

  const int = (name: string, fallback: number, min: number, max: number): number => {
    const value = raw[name];
    if (value === undefined || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      errors.push(`${name} must be an integer between ${min} and ${max}`);
      return fallback;
    }
    return parsed;
  };

  const bool = (name: string, fallback: boolean): boolean => {
    const value = raw[name];
    if (value === undefined || value === '') return fallback;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    errors.push(`${name} must be "true" or "false"`);
    return fallback;
  };

  const env: Env = {
    PORT: int('PORT', 3000, 1, 65535),
    MONGO_URI: str('MONGO_URI'),
    JWT_ACCESS_SECRET: str('JWT_ACCESS_SECRET', { minLength: 32 }),
    JWT_REFRESH_SECRET: str('JWT_REFRESH_SECRET', { minLength: 32 }),
    JWT_ACCESS_TTL_SECONDS: int('JWT_ACCESS_TTL_SECONDS', 900, 10, 86_400),
    JWT_REFRESH_TTL_SECONDS: int('JWT_REFRESH_TTL_SECONDS', 604_800, 60, 7_776_000),
    BCRYPT_ROUNDS: int('BCRYPT_ROUNDS', 10, 4, 15),
    COOKIE_SECURE: bool('COOKIE_SECURE', false),
    AUTH_RATE_LIMIT: int('AUTH_RATE_LIMIT', 20, 1, 10_000),
    MINIO_ENDPOINT: str('MINIO_ENDPOINT'),
    MINIO_PORT: int('MINIO_PORT', 9000, 1, 65535),
    MINIO_USE_SSL: bool('MINIO_USE_SSL', false),
    MINIO_ACCESS_KEY: str('MINIO_ACCESS_KEY'),
    MINIO_SECRET_KEY: str('MINIO_SECRET_KEY'),
    MINIO_BUCKET: str('MINIO_BUCKET'),
    MINIO_PUBLIC_URL: str('MINIO_PUBLIC_URL'),
    MAX_UPLOAD_MB: int('MAX_UPLOAD_MB', 200, 1, 5_000),
  };

  if (env.JWT_ACCESS_SECRET !== '' && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
  if (env.MINIO_PUBLIC_URL !== '' && !URL.canParse(env.MINIO_PUBLIC_URL)) {
    errors.push('MINIO_PUBLIC_URL must be an absolute URL, e.g. http://localhost:9000');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n  - ${errors.join('\n  - ')}`);
  }
  return env;
}
