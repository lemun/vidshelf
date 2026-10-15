// Defaults for the e2e run; any of these can be overridden from the shell.
const defaults: Record<string, string> = {
  MONGO_URI: 'mongodb://localhost:27017/vidshelf_e2e',
  JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789abcdefghij',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdefghij',
  BCRYPT_ROUNDS: '4',
  AUTH_RATE_LIMIT: '1000',
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: '9000',
  MINIO_ACCESS_KEY: 'minioadmin',
  MINIO_SECRET_KEY: 'minioadmin',
  MINIO_BUCKET: 'vidshelf-e2e',
  MINIO_PUBLIC_URL: 'http://localhost:9000',
  MAX_UPLOAD_MB: '1',
};
for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
