import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

import { UsersModule } from '../users/users.module';
import { Video, VideoSchema } from './schemas/video.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
        forwardRef(() => UsersModule),
    ],
    controllers: [VideosController],
    providers: [VideosService],
    exports: [VideosService, MongooseModule],
})

export class VideosModule {}
