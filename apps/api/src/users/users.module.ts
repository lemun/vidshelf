import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { VideosModule } from '../videos/videos.module';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
        forwardRef(() => VideosModule),
    ],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService, MongooseModule],
})

export class UsersModule {}
