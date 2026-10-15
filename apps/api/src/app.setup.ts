import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { REFRESH_COOKIE } from './auth/auth.controller';
import { MongoExceptionFilter } from './common/filters/mongo-exception.filter';

/** Shared by main.ts and the e2e tests so both run the exact same HTTP pipeline. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  // One reverse proxy (nginx or the Vite dev server) sits in front: trust its X-Forwarded-For
  // so rate limiting is per client, not per proxy.
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new MongoExceptionFilter(app.get(HttpAdapterHost).httpAdapter));

  const config = new DocumentBuilder()
    .setTitle('Vidshelf API')
    .setDescription(
      'Accounts with rotating refresh tokens, direct-to-MinIO uploads, video listing, search, likes and views.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE)
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config));
}
