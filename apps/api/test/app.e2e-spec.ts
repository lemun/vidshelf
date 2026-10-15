import { getConnectionToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

interface AuthBody {
  user: { id: string; username: string; email: string };
  accessToken: string;
}
interface UploadTarget {
  key: string;
  url: string;
  fields: Record<string, string>;
}
interface VideoBody {
  id: string;
  title: string;
  description: string;
  views: number;
  likes: number;
  likedByMe: boolean;
  streamUrl: string;
  thumbnailUrl: string | null;
  owner: { id: string; username: string };
}

const VIDEO_BYTES = Buffer.alloc(4096, 7);

/** The refresh cookie pair (`vidshelf_rt=...`) from a response, ready to send back. */
function refreshCookie(res: request.Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((c) => c.startsWith('vidshelf_rt='));
  if (!cookie) throw new Error('no refresh cookie set');
  return cookie.split(';')[0];
}

/** Uploads bytes to MinIO with the presigned POST, the same way the browser does. */
async function postToStorage(target: UploadTarget, bytes: Buffer, contentType: string) {
  const form = new FormData();
  for (const [name, value] of Object.entries(target.fields)) form.append(name, value);
  form.append('file', new Blob([new Uint8Array(bytes)], { type: contentType }));
  return fetch(target.url, { method: 'POST', body: form });
}

describe('Vidshelf API (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let alice: AuthBody;
  let bob: AuthBody;
  let videoId: string;

  const auth = (who: AuthBody) => ({ Authorization: `Bearer ${who.accessToken}` });

  async function register(username: string) {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ username, email: `${username}@example.com`, password: 'correct-horse-42' })
      .expect(201);
    return res.body as AuthBody;
  }

  async function upload(
    who: AuthBody,
    kind: 'video' | 'thumbnail',
    contentType: string,
    bytes: Buffer,
  ) {
    const res = await request(server)
      .post('/api/videos/uploads')
      .set(auth(who))
      .send({ kind, contentType, sizeBytes: bytes.length })
      .expect(201);
    const target = res.body as UploadTarget;
    const stored = await postToStorage(target, bytes, contentType);
    expect(stored.status).toBe(204);
    return target.key;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error'] });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
    await app.get<Connection>(getConnectionToken()).dropDatabase();
  });

  afterAll(async () => {
    await app.get<Connection>(getConnectionToken()).dropDatabase();
    await app.close();
  });

  it('reports health', async () => {
    await request(server).get('/api/health').expect(200, { status: 'ok' });
  });

  describe('auth', () => {
    it('validates registration input and rejects unknown fields', async () => {
      const res = await request(server)
        .post('/api/auth/register')
        .send({ username: 'x', email: 'nope', password: 'short', admin: true })
        .expect(400);
      const messages = (res.body as { message: string[] }).message.join(' | ');
      expect(messages).toContain('property admin should not exist');
      expect(messages).toContain('email must be an email');
      expect(messages).toContain('password must be longer than or equal to 8 characters');
    });

    it('registers, sets an httpOnly refresh cookie scoped to /api/auth, never leaks the hash', async () => {
      const res = await request(server)
        .post('/api/auth/register')
        .send({ username: 'alice', email: 'Alice@Example.com', password: 'correct-horse-42' })
        .expect(201);
      alice = res.body as AuthBody;
      expect(alice.user).toMatchObject({ username: 'alice', email: 'alice@example.com' });
      expect(alice.user).not.toHaveProperty('passwordHash');
      const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
      expect(cookie).toMatch(
        /^vidshelf_rt=.+; Path=\/api\/auth; Expires=.+; HttpOnly; SameSite=Strict$/,
      );
    });

    it('rejects a duplicate email with 409', async () => {
      await request(server)
        .post('/api/auth/register')
        .send({ username: 'alice2', email: 'alice@example.com', password: 'correct-horse-42' })
        .expect(409);
    });

    it('signs in with the right password only', async () => {
      await request(server)
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: 'wrong-horse-42' })
        .expect(401);
      const res = await request(server)
        .post('/api/auth/login')
        .send({ email: 'ALICE@example.com', password: 'correct-horse-42' })
        .expect(200);
      alice = res.body as AuthBody;
    });

    it('protects /me', async () => {
      await request(server).get('/api/auth/me').expect(401);
      await request(server).get('/api/auth/me').set('Authorization', 'Bearer junk').expect(401);
      const res = await request(server).get('/api/auth/me').set(auth(alice)).expect(200);
      expect((res.body as { user: { username: string } }).user.username).toBe('alice');
    });

    it('rotates refresh tokens and revokes the whole family on reuse', async () => {
      const login = await request(server)
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: 'correct-horse-42' })
        .expect(200);
      const first = refreshCookie(login);

      const rotated = await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', first)
        .expect(200);
      const second = refreshCookie(rotated);
      expect(second).not.toBe(first);
      expect((rotated.body as AuthBody).accessToken).toEqual(expect.any(String));

      // A second tab that sent the same token at once gets one grace answer: an access token, and
      // no new cookie (the winning refresh already set it).
      const graced = await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', first)
        .expect(200);
      expect((graced.body as AuthBody).accessToken).toEqual(expect.any(String));
      expect(graced.headers['set-cookie']).toBeUndefined();

      // Replaying the consumed token again is treated as theft...
      await request(server).post('/api/auth/refresh').set('Cookie', first).expect(401);
      // ...so the legitimately rotated token is now dead too.
      await request(server).post('/api/auth/refresh').set('Cookie', second).expect(401);
    });

    it('logs out by revoking the cookie token', async () => {
      const login = await request(server)
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: 'correct-horse-42' })
        .expect(200);
      const cookie = refreshCookie(login);
      const out = await request(server).post('/api/auth/logout').set('Cookie', cookie).expect(204);
      expect((out.headers['set-cookie'] as unknown as string[])[0]).toMatch(/^vidshelf_rt=;/);
      await request(server).post('/api/auth/refresh').set('Cookie', cookie).expect(401);
      await request(server).post('/api/auth/refresh').expect(401);
    });
  });

  describe('videos', () => {
    beforeAll(async () => {
      bob = await register('bob');
    });

    it('requires auth to request an upload and enforces type and size limits', async () => {
      await request(server)
        .post('/api/videos/uploads')
        .send({ kind: 'video', contentType: 'video/webm', sizeBytes: 10 })
        .expect(401);
      await request(server)
        .post('/api/videos/uploads')
        .set(auth(alice))
        .send({ kind: 'video', contentType: 'application/x-msdownload', sizeBytes: 10 })
        .expect(400);
      await request(server)
        .post('/api/videos/uploads')
        .set(auth(alice))
        .send({ kind: 'video', contentType: 'video/webm', sizeBytes: 2 * 1024 * 1024 })
        .expect(413);
    });

    it('lets MinIO reject an upload that does not match the signed policy', async () => {
      const res = await request(server)
        .post('/api/videos/uploads')
        .set(auth(alice))
        .send({ kind: 'video', contentType: 'video/webm', sizeBytes: VIDEO_BYTES.length })
        .expect(201);
      const target = res.body as UploadTarget;
      const tampered = { ...target, fields: { ...target.fields, 'Content-Type': 'text/html' } };
      const stored = await postToStorage(tampered, VIDEO_BYTES, 'text/html');
      expect(stored.status).toBe(403);
    });

    it('refuses to publish a key that was never uploaded or belongs to someone else', async () => {
      const res = await request(server)
        .post('/api/videos/uploads')
        .set(auth(alice))
        .send({ kind: 'video', contentType: 'video/webm', sizeBytes: 10 })
        .expect(201);
      const neverUploaded = (res.body as UploadTarget).key;
      await request(server)
        .post('/api/videos')
        .set(auth(alice))
        .send({ title: 'Ghost', videoKey: neverUploaded })
        .expect(400);
      await request(server)
        .post('/api/videos')
        .set(auth(bob))
        .send({ title: 'Stolen', videoKey: neverUploaded })
        .expect(400);
    });

    it('publishes an uploaded video and streams it with range requests', async () => {
      const videoKey = await upload(alice, 'video', 'video/webm', VIDEO_BYTES);
      const thumbnailKey = await upload(alice, 'thumbnail', 'image/jpeg', Buffer.alloc(512, 1));

      const res = await request(server)
        .post('/api/videos')
        .set(auth(alice))
        .send({
          title: 'Harbour timelapse',
          description: 'Boats leaving at dawn',
          videoKey,
          thumbnailKey,
          durationSeconds: 2.5,
        })
        .expect(201);
      const video = res.body as VideoBody;
      videoId = video.id;
      expect(video).toMatchObject({
        title: 'Harbour timelapse',
        views: 0,
        likes: 0,
        likedByMe: false,
        owner: { username: 'alice' },
      });
      expect(video).not.toHaveProperty('videoKey');

      const ranged = await fetch(video.streamUrl, { headers: { Range: 'bytes=0-99' } });
      expect(ranged.status).toBe(206);
      expect(ranged.headers.get('content-type')).toBe('video/webm');
      expect((await ranged.arrayBuffer()).byteLength).toBe(100);

      const thumb = await fetch(video.thumbnailUrl!);
      expect(thumb.status).toBe(200);
    });

    it('lists and searches', async () => {
      const all = await request(server).get('/api/videos').expect(200);
      expect(all.body).toMatchObject({ total: 1, page: 1, limit: 24 });

      const hit = await request(server).get('/api/videos').query({ q: 'harbour' }).expect(200);
      expect((hit.body as { items: VideoBody[] }).items.map((v) => v.id)).toEqual([videoId]);

      const miss = await request(server).get('/api/videos').query({ q: 'volcano' }).expect(200);
      expect(miss.body).toMatchObject({ items: [], total: 0 });

      const byOwner = await request(server)
        .get('/api/videos')
        .query({ owner: bob.user.id })
        .expect(200);
      expect(byOwner.body).toMatchObject({ total: 0 });

      await request(server).get('/api/videos').query({ page: 0 }).expect(400);
      await request(server).get('/api/videos').query({ limit: 500 }).expect(400);
    });

    it('fetches one video by id, with 400 for bad ids and 404 for unknown ones', async () => {
      await request(server).get(`/api/videos/${videoId}`).expect(200);
      await request(server).get('/api/videos/not-an-id').expect(400);
      await request(server).get('/api/videos/0123456789abcdef01234567').expect(404);
    });

    it('likes idempotently and reports likedByMe per viewer', async () => {
      await request(server).put(`/api/videos/${videoId}/like`).expect(401);
      await request(server).put(`/api/videos/${videoId}/like`).set(auth(bob)).expect(200);
      const again = await request(server)
        .put(`/api/videos/${videoId}/like`)
        .set(auth(bob))
        .expect(200);
      expect(again.body).toEqual({ likes: 1, likedByMe: true });

      const asBob = await request(server).get(`/api/videos/${videoId}`).set(auth(bob)).expect(200);
      expect(asBob.body).toMatchObject({ likes: 1, likedByMe: true });
      const anonymous = await request(server).get(`/api/videos/${videoId}`).expect(200);
      expect(anonymous.body).toMatchObject({ likes: 1, likedByMe: false });
      // An expired or bogus token on a public route degrades to anonymous instead of failing.
      await request(server)
        .get(`/api/videos/${videoId}`)
        .set('Authorization', 'Bearer junk')
        .expect(200);

      const unliked = await request(server)
        .delete(`/api/videos/${videoId}/like`)
        .set(auth(bob))
        .expect(200);
      expect(unliked.body).toEqual({ likes: 0, likedByMe: false });
      await request(server).delete(`/api/videos/${videoId}/like`).set(auth(bob)).expect(200);
      const after = await request(server).get(`/api/videos/${videoId}`).expect(200);
      expect(after.body).toMatchObject({ likes: 0 });
    });

    it('counts views', async () => {
      await request(server).post(`/api/videos/${videoId}/views`).expect(200, { views: 1 });
      await request(server).post(`/api/videos/${videoId}/views`).expect(200, { views: 2 });
    });

    it('only lets the uploader edit or delete', async () => {
      await request(server)
        .patch(`/api/videos/${videoId}`)
        .set(auth(bob))
        .send({ title: 'Mine now' })
        .expect(403);
      const edited = await request(server)
        .patch(`/api/videos/${videoId}`)
        .set(auth(alice))
        .send({ title: 'Harbour at dawn' })
        .expect(200);
      expect(edited.body).toMatchObject({
        title: 'Harbour at dawn',
        description: 'Boats leaving at dawn',
      });

      const { streamUrl } = edited.body as VideoBody;
      await request(server).delete(`/api/videos/${videoId}`).set(auth(bob)).expect(403);
      await request(server).delete(`/api/videos/${videoId}`).set(auth(alice)).expect(204);
      await request(server).get(`/api/videos/${videoId}`).expect(404);
      expect((await fetch(streamUrl)).status).toBe(404);
    });
  });
});
