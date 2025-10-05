import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';

import { environments } from 'src/environments/environments';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly client: Client;
  private readonly bucketName = environments.minioBucket;

  constructor() {
    this.client = new Client({
      endPoint: environments.minioEndpoint,
      port: Number(environments.minioPort),
      useSSL: environments.minioUseSsl === 'true',
      accessKey: environments.minioAccessKey,
      secretKey: environments.minioSecretKey,
    });
  }

  async onModuleInit() {
    const exists = await this.client.bucketExists(this.bucketName);
    if (!exists) {
      await this.client.makeBucket(this.bucketName, '');
      console.log(`Bucket "${this.bucketName}" created`);
    }
  }

  async uploadFile(objectName: string, filePath: string, mimeType?: string) {
    await this.client.fPutObject(this.bucketName, objectName, filePath, {
      'Content-Type': mimeType || 'application/octet-stream',
    });
    return this.getFileUrl(objectName);
  }

  async getFileUrl(objectName: string) {
    return await this.client.presignedUrl('GET', this.bucketName, objectName, 24 * 60 * 60);
  }

  async removeFile(objectName: string) {
    await this.client.removeObject(this.bucketName, objectName);
  }
}
