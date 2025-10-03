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
  jwtSecret: assertEnvironment('JWT_SECRET'),
  jwtAccessTokenTtl: assertEnvironment('JWT_ACCESS_TOKEN_TTL'),
  mongoUri: assertEnvironment('MONGO_URI'),
  saltWorkFactor: assertEnvironment('SALT_WORK_FACTOR'),
};
