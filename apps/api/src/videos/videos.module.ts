import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MinioModule } from '../minio/minio.module';
import { Video, VideoSchema } from './schemas/video.schema';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]), MinioModule],
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}
