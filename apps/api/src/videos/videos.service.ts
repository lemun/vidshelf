import { Injectable } from '@nestjs/common';
import { MinioService } from 'src/minio/minio.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

@Injectable()
export class VideosService {
    constructor(private readonly minio: MinioService) {}

    async uploadFile(file: Express.Multer.File) {
        const url = await this.minio.uploadFile(file.filename, file.path, file.mimetype);
        return { url };
    }

    create(_uploaderId: string, _dto: CreateVideoDto) {} // TODO: implement
    update(_id: string, _dto: UpdateVideoDto, _byUserId: string) {} // TODO: implement
    remove(_id: string, _byUserId: string) {} // TODO: implement

    findById(_id: string) {} // TODO: implement

    incrementView(_id: string, _userIdOrNull: string | null) {} // TODO: implement

    like(_id: string, _userId: string) {} // TODO: implement
    dislike(_id: string, _userId: string) {} // TODO: implement
    clearReaction(_id: string, _userId: string) {} // TODO: implement

    getStats(_id: string) {} // TODO: implement
}
