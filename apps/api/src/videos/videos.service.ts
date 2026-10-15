import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model, QueryFilter, Types } from 'mongoose';
import type { Env } from '../config/env';
import { MinioService } from '../minio/minio.service';
import { CreateUploadDto, THUMBNAIL_TYPES, VIDEO_TYPES } from './dto/create-upload.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { ListVideosQuery } from './dto/list-videos.query';
import { UpdateVideoDto } from './dto/update-video.dto';
import { Video } from './schemas/video.schema';
import type { UploadTarget, VideoDetail, VideoPage, VideoSummary } from './video.dto';

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type OwnerRef = { _id: Types.ObjectId; username: string };
type VideoWithOwner = Omit<Video, 'owner' | 'likedBy'> & { owner: OwnerRef | null };

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);
  private readonly maxVideoBytes: number;

  constructor(
    @InjectModel(Video.name) private readonly videos: Model<Video>,
    private readonly storage: MinioService,
    config: ConfigService<Env, true>,
  ) {
    this.maxVideoBytes = config.get('MAX_UPLOAD_MB', { infer: true }) * 1024 * 1024;
  }

  /** Step 1 of an upload: a presigned POST the browser uses to send the file to MinIO directly. */
  async createUploadTarget(userId: string, dto: CreateUploadDto): Promise<UploadTarget> {
    const allowed: readonly string[] = dto.kind === 'video' ? VIDEO_TYPES : THUMBNAIL_TYPES;
    if (!allowed.includes(dto.contentType)) {
      throw new BadRequestException(`${dto.contentType} is not an accepted ${dto.kind} type`);
    }
    const maxBytes = dto.kind === 'video' ? this.maxVideoBytes : MAX_THUMBNAIL_BYTES;
    if (dto.sizeBytes > maxBytes) {
      throw new PayloadTooLargeException(`${dto.kind} must be at most ${maxBytes} bytes`);
    }

    const key = `${dto.kind}s/${userId}/${randomUUID()}.${EXTENSIONS[dto.contentType]}`;
    const policy = await this.storage.createUploadPolicy(key, dto.contentType, maxBytes);
    return {
      key,
      url: policy.url,
      fields: policy.fields,
      maxBytes,
      expiresAt: policy.expiresAt.toISOString(),
    };
  }

  /** Step 2 of an upload: register the uploaded object as a video after checking it exists. */
  async create(userId: string, dto: CreateVideoDto): Promise<VideoDetail> {
    assertOwnedKey(dto.videoKey, 'videos', userId);
    if (dto.thumbnailKey) assertOwnedKey(dto.thumbnailKey, 'thumbnails', userId);

    const object = await this.storage.stat(dto.videoKey);
    if (!object) {
      throw new BadRequestException('Video upload not found; upload the file before creating');
    }
    if (dto.thumbnailKey && !(await this.storage.stat(dto.thumbnailKey))) {
      throw new BadRequestException('Thumbnail upload not found');
    }

    const created = await this.videos.create({
      owner: new Types.ObjectId(userId),
      title: dto.title,
      description: dto.description ?? '',
      videoKey: dto.videoKey,
      thumbnailKey: dto.thumbnailKey ?? null,
      contentType: object.contentType,
      sizeBytes: object.size,
      durationSeconds: dto.durationSeconds ?? null,
    });
    return this.findOne(created._id.toString(), userId);
  }

  async list(query: ListVideosQuery): Promise<VideoPage> {
    const filter: QueryFilter<Video> = {};
    if (query.q) filter.$text = { $search: query.q };
    if (query.owner) filter.owner = new Types.ObjectId(query.owner);

    const find = this.videos.find(filter);
    if (query.q) {
      find
        .select({ score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, _id: -1 });
    } else {
      find.sort({ createdAt: -1, _id: -1 });
    }

    const [docs, total] = await Promise.all([
      find
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate('owner', 'username')
        .lean<VideoWithOwner[]>()
        .exec(),
      this.videos.countDocuments(filter).exec(),
    ]);

    return {
      items: await Promise.all(docs.map((doc) => this.toSummary(doc))),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string, viewerId?: string): Promise<VideoDetail> {
    const doc = await this.videos
      .findById(id)
      .populate('owner', 'username')
      .lean<VideoWithOwner>()
      .exec();
    if (!doc) throw new NotFoundException('Video not found');

    const likedByMe = viewerId
      ? (await this.videos
          .exists({ _id: doc._id, likedBy: new Types.ObjectId(viewerId) })
          .exec()) !== null
      : false;

    return {
      ...(await this.toSummary(doc)),
      description: doc.description,
      contentType: doc.contentType,
      sizeBytes: doc.sizeBytes,
      streamUrl: await this.storage.presignGet(doc.videoKey),
      likedByMe,
    };
  }

  async update(id: string, userId: string, dto: UpdateVideoDto): Promise<VideoDetail> {
    await this.assertOwner(id, userId);
    const changes: Partial<Pick<Video, 'title' | 'description'>> = {};
    if (dto.title !== undefined) changes.title = dto.title;
    if (dto.description !== undefined) changes.description = dto.description;
    await this.videos.updateOne({ _id: id }, { $set: changes }).exec();
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const video = await this.assertOwner(id, userId);
    await this.videos.deleteOne({ _id: id }).exec();
    const keys = [video.videoKey, ...(video.thumbnailKey ? [video.thumbnailKey] : [])];
    try {
      await this.storage.remove(keys);
    } catch (error) {
      // The record is gone either way; an orphaned object is cheaper than a failed delete.
      this.logger.warn(`Could not remove objects ${keys.join(', ')}: ${String(error)}`);
    }
  }

  /** Counts a play. Not de-duplicated per viewer (see README "What is not done"). */
  async registerView(id: string): Promise<{ views: number }> {
    const updated = await this.videos
      .findByIdAndUpdate(
        id,
        { $inc: { views: 1 } },
        { returnDocument: 'after', projection: { views: 1 } },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Video not found');
    return { views: updated.views };
  }

  /**
   * Idempotent: the filter only matches when the user has not liked yet, so `$inc` and
   * `$addToSet` happen together or not at all (single-document atomic update).
   */
  async like(id: string, userId: string): Promise<{ likes: number; likedByMe: boolean }> {
    const user = new Types.ObjectId(userId);
    await this.videos
      .updateOne(
        { _id: id, likedBy: { $ne: user } },
        { $addToSet: { likedBy: user }, $inc: { likes: 1 } },
      )
      .exec();
    return { likes: await this.currentLikes(id), likedByMe: true };
  }

  async unlike(id: string, userId: string): Promise<{ likes: number; likedByMe: boolean }> {
    const user = new Types.ObjectId(userId);
    await this.videos
      .updateOne({ _id: id, likedBy: user }, { $pull: { likedBy: user }, $inc: { likes: -1 } })
      .exec();
    return { likes: await this.currentLikes(id), likedByMe: false };
  }

  private async currentLikes(id: string): Promise<number> {
    const doc = await this.videos.findById(id, { likes: 1 }).lean().exec();
    if (!doc) throw new NotFoundException('Video not found');
    return doc.likes;
  }

  private async assertOwner(id: string, userId: string) {
    const video = await this.videos
      .findById(id, { owner: 1, videoKey: 1, thumbnailKey: 1 })
      .lean()
      .exec();
    if (!video) throw new NotFoundException('Video not found');
    if (video.owner.toString() !== userId) {
      throw new ForbiddenException('Only the uploader can change this video');
    }
    return video;
  }

  private async toSummary(doc: VideoWithOwner): Promise<VideoSummary> {
    return {
      id: doc._id.toString(),
      title: doc.title,
      owner: doc.owner
        ? { id: doc.owner._id.toString(), username: doc.owner.username }
        : { id: '', username: 'deleted user' },
      views: doc.views,
      likes: doc.likes,
      durationSeconds: doc.durationSeconds,
      thumbnailUrl: doc.thumbnailKey ? await this.storage.presignGet(doc.thumbnailKey) : null,
      createdAt: doc.createdAt.toISOString(),
    };
  }
}

/** Keys are minted by `createUploadTarget` as `<kind>s/<userId>/<uuid>.<ext>`. */
function assertOwnedKey(key: string, prefix: 'videos' | 'thumbnails', userId: string): void {
  const pattern = new RegExp(`^${prefix}/${userId}/[0-9a-f-]{36}\\.[a-z0-9]{2,4}$`);
  if (!pattern.test(key)) {
    throw new BadRequestException(
      `${prefix === 'videos' ? 'videoKey' : 'thumbnailKey'} is not one of your uploads`,
    );
  }
}
