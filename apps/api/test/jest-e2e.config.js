/**
 * End-to-end tests against a real MongoDB and MinIO (start them with
 * `docker compose up -d mongo minio minio-init` from the repo root).
 * They use their own database and bucket, so they never touch dev data.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '\\.e2e-spec\\.ts$',
  setupFiles: ['<rootDir>/e2e-env.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  testEnvironment: 'node',
  testTimeout: 30000,
};
