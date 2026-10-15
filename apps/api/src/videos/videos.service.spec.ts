import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { Env } from '../config/env';
import type { MinioService } from '../minio/minio.service';
import type { Video } from './schemas/video.schema';
import { VideosService } from './videos.service';

/** A chainable stand-in for a Mongoose query that resolves to `result` on `exec()`. */
function query(result: unknown) {
  const q: Record<string, jest.Mock> = {};
  for (const method of ['select', 'sort', 'skip', 'limit', 'populate', 'lean']) {
    q[method] = jest.fn(() => q);
  }
  q.exec = jest.fn(() => Promise.resolve(result));
  return q;
}

const owner = new Types.ObjectId();
const stranger = new Types.ObjectId();
const UUID = '0b0f6f0e-6c1e-4d5f-9a39-6f7e1c2b3a4d';

function storedVideo(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    owner: { _id: owner, username: 'uploader' },
    title: 'Sunset',
    description: 'From the balcony',
    videoKey: `videos/${owner.toString()}/${UUID}.webm`,
    thumbnailKey: `thumbnails/${owner.toString()}/${UUID}.jpg`,
    contentType: 'video/webm',
    sizeBytes: 1234,
    durationSeconds: 2,
    views: 3,
    likes: 1,
    createdAt: new Date('2026-02-03T04:05:06Z'),
    ...overrides,
  };
}

describe('VideosService', () => {
  let model: Record<string, jest.Mock>;
  let storage: jest.Mocked<
    Pick<MinioService, 'createUploadPolicy' | 'presignGet' | 'stat' | 'remove'>
  >;
  let service: VideosService;

  beforeEach(() => {
    model = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      exists: jest.fn(),
      updateOne: jest.fn(() => query({ modifiedCount: 1 })),
      deleteOne: jest.fn(() => query({ deletedCount: 1 })),
    };
    storage = {
      createUploadPolicy: jest.fn().mockResolvedValue({
        url: 'http://localhost:9000/vidshelf',
        fields: { policy: 'p' },
        expiresAt: new Date('2026-01-01T00:15:00Z'),
      }),
      presignGet: jest.fn((key: string) => Promise.resolve(`signed:${key}`)),
      stat: jest.fn().mockResolvedValue({ size: 1234, contentType: 'video/webm' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const config = { get: () => 10 } as unknown as ConfigService<Env, true>; // MAX_UPLOAD_MB
    service = new VideosService(
      model as unknown as Model<Video>,
      storage as unknown as MinioService,
      config,
    );
  });

  describe('createUploadTarget', () => {
    it('mints a key under the user prefix and asks MinIO to enforce type and size', async () => {
      const target = await service.createUploadTarget(owner.toString(), {
        kind: 'video',
        contentType: 'video/mp4',
        sizeBytes: 1000,
      });
      expect(target.key).toMatch(new RegExp(`^videos/${owner.toString()}/[0-9a-f-]{36}\\.mp4$`));
      expect(storage.createUploadPolicy).toHaveBeenCalledWith(
        target.key,
        'video/mp4',
        10 * 1024 * 1024,
      );
      expect(target).toMatchObject({
        url: 'http://localhost:9000/vidshelf',
        fields: { policy: 'p' },
      });
    });

    it('rejects a content type that does not match the kind', async () => {
      await expect(
        service.createUploadTarget(owner.toString(), {
          kind: 'video',
          contentType: 'image/png',
          sizeBytes: 10,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects files over the limit before signing anything', async () => {
      await expect(
        service.createUploadTarget(owner.toString(), {
          kind: 'thumbnail',
          contentType: 'image/jpeg',
          sizeBytes: 3 * 1024 * 1024,
        }),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
      expect(storage.createUploadPolicy).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it("refuses another user's upload key without touching storage", async () => {
      await expect(
        service.create(stranger.toString(), {
          title: 'Mine now',
          videoKey: `videos/${owner.toString()}/${UUID}.webm`,
        }),
      ).rejects.toThrow('videoKey is not one of your uploads');
      expect(storage.stat).not.toHaveBeenCalled();
    });

    it('refuses a key whose object was never uploaded', async () => {
      storage.stat.mockResolvedValue(null);
      await expect(
        service.create(owner.toString(), {
          title: 'Ghost',
          videoKey: `videos/${owner.toString()}/${UUID}.webm`,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('stores size and type as reported by storage, not by the client', async () => {
      const doc = storedVideo();
      model.create.mockResolvedValue({ _id: doc._id });
      model.findById.mockReturnValue(query(doc));
      model.exists.mockReturnValue(query(null));

      const result = await service.create(owner.toString(), {
        title: 'Sunset',
        videoKey: doc.videoKey,
        thumbnailKey: doc.thumbnailKey,
        durationSeconds: 2,
      });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ sizeBytes: 1234, contentType: 'video/webm', description: '' }),
      );
      expect(result.streamUrl).toBe(`signed:${doc.videoKey}`);
      expect(result.thumbnailUrl).toBe(`signed:${doc.thumbnailKey}`);
      expect(result).not.toHaveProperty('videoKey');
      expect(result).not.toHaveProperty('likedBy');
    });
  });

  describe('list', () => {
    it('uses the text index and relevance order when searching', async () => {
      const find = query([storedVideo()]);
      model.find.mockReturnValue(find);
      model.countDocuments.mockReturnValue(query(1));

      const page = await service.list({ q: 'sunset', page: 2, limit: 10 });

      expect(model.find).toHaveBeenCalledWith({ $text: { $search: 'sunset' } });
      expect(find.sort).toHaveBeenCalledWith({ score: { $meta: 'textScore' }, _id: -1 });
      expect(find.skip).toHaveBeenCalledWith(10);
      expect(page).toMatchObject({ total: 1, page: 2, limit: 10 });
      expect(page.items[0]).toEqual({
        id: expect.any(String),
        title: 'Sunset',
        owner: { id: owner.toString(), username: 'uploader' },
        views: 3,
        likes: 1,
        durationSeconds: 2,
        thumbnailUrl: expect.stringContaining('signed:thumbnails/'),
        createdAt: '2026-02-03T04:05:06.000Z',
      });
    });

    it('lists newest first without a query', async () => {
      const find = query([]);
      model.find.mockReturnValue(find);
      model.countDocuments.mockReturnValue(query(0));
      await service.list({ page: 1, limit: 24 });
      expect(model.find).toHaveBeenCalledWith({});
      expect(find.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    });
  });

  describe('ownership', () => {
    it('404s for a missing video and 403s for a non-owner', async () => {
      model.findById.mockReturnValueOnce(query(null));
      await expect(service.update('id', owner.toString(), { title: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );

      model.findById.mockReturnValueOnce(query(storedVideo({ owner })));
      await expect(service.remove('id', stranger.toString())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(model.deleteOne).not.toHaveBeenCalled();
    });

    it('deletes the record and its objects, tolerating a storage failure', async () => {
      const doc = storedVideo({ owner });
      model.findById.mockReturnValueOnce(query(doc));
      storage.remove.mockRejectedValue(new Error('minio down'));

      await expect(service.remove('id', owner.toString())).resolves.toBeUndefined();
      expect(model.deleteOne).toHaveBeenCalledWith({ _id: 'id' });
      expect(storage.remove).toHaveBeenCalledWith([doc.videoKey, doc.thumbnailKey]);
    });
  });

  describe('likes and views', () => {
    it('likes atomically and only if not already liked', async () => {
      model.findById.mockReturnValue(query({ likes: 2 }));
      const result = await service.like('vid', stranger.toString());
      const [filter, update] = model.updateOne.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(filter).toEqual({ _id: 'vid', likedBy: { $ne: stranger } });
      expect(update).toEqual({ $addToSet: { likedBy: stranger }, $inc: { likes: 1 } });
      expect(result).toEqual({ likes: 2, likedByMe: true });
    });

    it('unlikes only if previously liked', async () => {
      model.findById.mockReturnValue(query({ likes: 0 }));
      const result = await service.unlike('vid', stranger.toString());
      const [filter, update] = model.updateOne.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(filter).toEqual({ _id: 'vid', likedBy: stranger });
      expect(update).toEqual({ $pull: { likedBy: stranger }, $inc: { likes: -1 } });
      expect(result).toEqual({ likes: 0, likedByMe: false });
    });

    it('404s when liking a video that does not exist', async () => {
      model.findById.mockReturnValue(query(null));
      await expect(service.like('vid', stranger.toString())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('increments views and returns the new count', async () => {
      model.findByIdAndUpdate.mockReturnValue(query({ views: 4 }));
      await expect(service.registerView('vid')).resolves.toEqual({ views: 4 });
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'vid',
        { $inc: { views: 1 } },
        expect.objectContaining({ returnDocument: 'after' }),
      );
    });
  });
});
