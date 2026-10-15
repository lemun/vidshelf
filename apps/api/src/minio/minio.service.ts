import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import type { Env } from '../config/env';

const REGION = 'us-east-1';

export interface UploadPolicy {
  /** Where the browser POSTs a multipart form: all `fields`, then the file as `file`. */
  url: string;
  fields: Record<string, string>;
  expiresAt: Date;
}

export interface StoredObject {
  size: number;
  contentType: string;
}

/**
 * Thin wrapper over the MinIO SDK.
 *
 * Two clients are used on purpose: `client` talks to MinIO from the API's network position
 * (e.g. `minio:9000` inside docker compose), while `signer` only computes signatures for the URL
 * the *browser* will use (e.g. `http://localhost:9000`). S3 signatures cover the Host header, so a
 * URL signed for the internal host would be rejected when the browser uses it. Presigning is pure
 * computation (the region is fixed), so `signer` never opens a connection.
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Client;
  private readonly signer: Client;
  readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    const accessKey = config.get('MINIO_ACCESS_KEY', { infer: true });
    const secretKey = config.get('MINIO_SECRET_KEY', { infer: true });
    this.bucket = config.get('MINIO_BUCKET', { infer: true });

    this.client = new Client({
      endPoint: config.get('MINIO_ENDPOINT', { infer: true }),
      port: config.get('MINIO_PORT', { infer: true }),
      useSSL: config.get('MINIO_USE_SSL', { infer: true }),
      accessKey,
      secretKey,
      region: REGION,
    });

    const publicUrl = new URL(config.get('MINIO_PUBLIC_URL', { infer: true }));
    const useSSL = publicUrl.protocol === 'https:';
    this.signer = new Client({
      endPoint: publicUrl.hostname,
      port: publicUrl.port ? Number(publicUrl.port) : useSSL ? 443 : 80,
      useSSL,
      accessKey,
      secretKey,
      region: REGION,
    });
  }

  /** Creates the bucket if missing (docker compose also does this in `minio-init`). */
  async onModuleInit(): Promise<void> {
    if (!(await this.client.bucketExists(this.bucket))) {
      await this.client.makeBucket(this.bucket, REGION);
      this.logger.log(`Created bucket "${this.bucket}"`);
    }
  }

  /**
   * A presigned POST policy: MinIO itself enforces the exact key, content type and size range, so
   * the browser uploads straight to storage and the API never buffers video bytes.
   */
  async createUploadPolicy(
    key: string,
    contentType: string,
    maxBytes: number,
    expiresInSeconds = 15 * 60,
  ): Promise<UploadPolicy> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const policy = this.signer.newPostPolicy();
    policy.setBucket(this.bucket);
    policy.setKey(key);
    policy.setContentType(contentType);
    policy.setContentLengthRange(1, maxBytes);
    policy.setExpires(expiresAt);
    const { postURL, formData } = await this.signer.presignedPostPolicy(policy);
    const fields: Record<string, string> = {};
    for (const [name, value] of Object.entries(formData)) fields[name] = String(value);
    return { url: postURL, fields, expiresAt };
  }

  /** A time-limited GET URL; browsers stream video from it with HTTP range requests. */
  presignGet(key: string, expiresInSeconds = 60 * 60): Promise<string> {
    return this.signer.presignedGetObject(this.bucket, key, expiresInSeconds);
  }

  /** Object size and content type, or `null` when the object does not exist. */
  async stat(key: string): Promise<StoredObject | null> {
    try {
      const stat = await this.client.statObject(this.bucket, key);
      const contentType = stat.metaData['content-type'] as unknown;
      return {
        size: stat.size,
        contentType: typeof contentType === 'string' ? contentType : 'application/octet-stream',
      };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'NotFound' || code === 'NoSuchKey') return null;
      throw error;
    }
  }

  async remove(keys: string[]): Promise<void> {
    if (keys.length > 0) await this.client.removeObjects(this.bucket, keys);
  }
}
