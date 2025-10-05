import dotenv from 'dotenv';

dotenv.config();

const assertEnvironment = (varName: string) => {
  const envVarValue = process.env[varName];

  if (!envVarValue) {
    throw new Error(`Environment variable ${varName} is not set`);
  }

  return envVarValue;
};

export const environments = {
  port: assertEnvironment('PORT'),
  jwtAccessTokenTtl: assertEnvironment('JWT_ACCESS_TOKEN_TTL'),
  jwtRefreshTokenTtl: assertEnvironment('JWT_REFRESH_TOKEN_TTL'),
  jwtAccessTokenSecret: assertEnvironment('JWT_ACCESS_TOKEN_SECRET'),
  jwtRefreshTokenSecret: assertEnvironment('JWT_REFRESH_TOKEN_SECRET'),
  mongoUri: assertEnvironment('MONGO_URI'),
  saltWorkFactor: assertEnvironment('SALT_WORK_FACTOR'),
  minioEndpoint: assertEnvironment('MINIO_ENDPOINT'),
  minioPort: assertEnvironment('MINIO_PORT'),
  minioAccessKey: assertEnvironment('MINIO_ACCESS_KEY'),
  minioSecretKey: assertEnvironment('MINIO_SECRET_KEY'),
  minioBucket: assertEnvironment('MINIO_BUCKET'),
  minioUseSsl: assertEnvironment('MINIO_USE_SSL'),
};
