/**
 * HTTP-layer tests with no database or object storage: the real controllers, global guard,
 * validation pipe, cookie handling and Swagger setup, with the two services mocked.
 * The full stack (real MongoDB + MinIO) is covered by test/app.e2e-spec.ts.
 */
import { UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from './app.setup';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { validateEnv } from './config/env';
import { VideosController } from './videos/videos.controller';
import { VideosService } from './videos/videos.service';

const ENV = validateEnv({
  MONGO_URI: 'mongodb://unused',
  JWT_ACCESS_SECRET: 'http-spec-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET: 'http-spec-refresh-secret-0123456789abcdef',
  MINIO_ENDPOINT: 'unused',
  MINIO_ACCESS_KEY: 'unused',
  MINIO_SECRET_KEY: 'unused',
  MINIO_BUCKET: 'unused',
  MINIO_PUBLIC_URL: 'http://localhost:9000',
});

const USER_ID = '65f0c0ffee0ddba11ca7f00d';
const VIDEO_ID = '65f0c0ffee0ddba11ca7beef';

describe('HTTP layer', () => {
  let app: NestExpressApplication;
  let server: App;
  let token: string;
  const auth = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    me: jest.fn(),
  };
  const videos = {
    list: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    createUploadTarget: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    registerView: jest.fn(),
    like: jest.fn(),
    unlike: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: () => ENV }),
        PassportModule,
        JwtModule.register({}),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
      ],
      controllers: [AuthController, VideosController],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: AuthService, useValue: auth },
        { provide: VideosService, useValue: videos },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
    token = new JwtService({}).sign(
      { sub: USER_ID, username: 'alice' },
      { secret: ENV.JWT_ACCESS_SECRET, expiresIn: 60 },
    );
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  describe('videos routes', () => {
    it('GET /api/videos/:id routes the id param (the original controller had no :id)', async () => {
      videos.findOne.mockResolvedValue({ id: VIDEO_ID });
      await request(server).get(`/api/videos/${VIDEO_ID}`).expect(200, { id: VIDEO_ID });
      expect(videos.findOne).toHaveBeenCalledWith(VIDEO_ID, undefined);
    });

    it('rejects malformed ids before reaching the service', async () => {
      await request(server).get('/api/videos/not-an-id').expect(400);
      expect(videos.findOne).not.toHaveBeenCalled();
    });

    it('treats a valid token on a public route as the viewer, and a bad one as anonymous', async () => {
      videos.findOne.mockResolvedValue({});
      await request(server)
        .get(`/api/videos/${VIDEO_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(videos.findOne).toHaveBeenLastCalledWith(VIDEO_ID, USER_ID);
      await request(server)
        .get(`/api/videos/${VIDEO_ID}`)
        .set('Authorization', 'Bearer junk')
        .expect(200);
      expect(videos.findOne).toHaveBeenLastCalledWith(VIDEO_ID, undefined);
    });

    it('validates and converts list query parameters', async () => {
      videos.list.mockResolvedValue({ items: [] });
      await request(server).get('/api/videos?limit=5&q=%20cats%20').expect(200);
      expect(videos.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 5, q: 'cats' }),
      );
      await request(server).get('/api/videos?page=0').expect(400);
      await request(server).get('/api/videos?owner=nope').expect(400);
      await request(server).get('/api/videos?sort=views').expect(400);
    });

    it('requires a token to publish and passes the caller id', async () => {
      const body = { title: '  Hello  ', videoKey: 'videos/x/y.mp4' };
      await request(server).post('/api/videos').send(body).expect(401);
      videos.create.mockResolvedValue({ id: VIDEO_ID });
      await request(server)
        .post('/api/videos')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(201);
      expect(videos.create).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ title: 'Hello' }),
      );
    });

    it('rejects unknown and invalid body fields', async () => {
      await request(server)
        .post('/api/videos')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'x', videoKey: 'k', views: 1_000_000 })
        .expect(400);
      await request(server)
        .post('/api/videos/uploads')
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'audio', contentType: 'video/mp4', sizeBytes: -1 })
        .expect(400);
      expect(videos.create).not.toHaveBeenCalled();
      expect(videos.createUploadTarget).not.toHaveBeenCalled();
    });

    it('returns 204 with no body on delete', async () => {
      videos.remove.mockResolvedValue(undefined);
      await request(server)
        .delete(`/api/videos/${VIDEO_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204, '');
    });
  });

  describe('auth routes', () => {
    const session = {
      user: { id: USER_ID, username: 'alice', email: 'a@example.com', createdAt: '' },
      accessToken: 'access',
      accessTokenExpiresIn: 900,
      refreshToken: 'refresh-token-value',
      refreshTokenExpiresAt: new Date(Date.now() + 3600_000),
    };

    it('moves the refresh token into an httpOnly cookie and out of the body', async () => {
      auth.login.mockResolvedValue(session);
      const res = await request(server)
        .post('/api/auth/login')
        .send({ email: ' A@Example.com ', password: 'pw' })
        .expect(200);
      expect(res.body).toEqual({
        user: session.user,
        accessToken: 'access',
        accessTokenExpiresIn: 900,
      });
      const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
      expect(cookie).toMatch(
        /^vidshelf_rt=refresh-token-value; Path=\/api\/auth; .*HttpOnly; SameSite=Strict$/,
      );
      expect(auth.login).toHaveBeenCalledWith(
        { email: 'a@example.com', password: 'pw' },
        expect.objectContaining({ ip: expect.any(String) }),
      );
    });

    it('refreshes from the cookie only, and clears the cookie when refresh fails', async () => {
      auth.refresh.mockResolvedValue(session);
      await request(server).post('/api/auth/refresh').set('Cookie', 'vidshelf_rt=abc').expect(200);
      expect(auth.refresh).toHaveBeenCalledWith('abc', expect.anything());

      auth.refresh.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));
      const res = await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', 'vidshelf_rt=stale')
        .expect(401);
      expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/^vidshelf_rt=;/);
    });

    it('protects /me', async () => {
      await request(server).get('/api/auth/me').expect(401);
      auth.me.mockResolvedValue({ user: session.user });
      await request(server).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(auth.me).toHaveBeenCalledWith(USER_ID);
    });
  });

  it('serves the OpenAPI document', async () => {
    const res = await request(server).get('/api/docs-json').expect(200);
    const paths = Object.keys((res.body as { paths: Record<string, unknown> }).paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/auth/login',
        '/api/videos',
        '/api/videos/{id}',
        '/api/videos/{id}/like',
      ]),
    );
  });
});
