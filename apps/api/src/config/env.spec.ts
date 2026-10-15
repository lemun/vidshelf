import { validateEnv } from './env';

const valid = {
  MONGO_URI: 'mongodb://localhost:27017/test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  MINIO_ENDPOINT: 'localhost',
  MINIO_ACCESS_KEY: 'key',
  MINIO_SECRET_KEY: 'secret',
  MINIO_BUCKET: 'bucket',
  MINIO_PUBLIC_URL: 'http://localhost:9000',
};

describe('validateEnv', () => {
  it('applies defaults and converts types', () => {
    const env = validateEnv({ ...valid, MINIO_PORT: '9100', COOKIE_SECURE: 'true' });
    expect(env).toMatchObject({
      PORT: 3000,
      MINIO_PORT: 9100,
      COOKIE_SECURE: true,
      MAX_UPLOAD_MB: 200,
    });
  });

  it('reports every problem at once', () => {
    expect(() =>
      validateEnv({ ...valid, MONGO_URI: '', JWT_ACCESS_SECRET: 'short', PORT: 'abc' }),
    ).toThrow(
      /PORT must be[\s\S]*MONGO_URI is required[\s\S]*JWT_ACCESS_SECRET must be at least 32/,
    );
  });

  it('refuses identical access and refresh secrets', () => {
    expect(() => validateEnv({ ...valid, JWT_REFRESH_SECRET: valid.JWT_ACCESS_SECRET })).toThrow(
      'must differ',
    );
  });
});
