import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
    // findAll
    findById(_id: string) {} // TODO: implement
    update(_id: string, _dto: UpdateUserDto, _byUserId: string) {} // TODO: implement
    remove(_id: string, _byUserId: string) {} // TODO: implement

    getVideos(_id: string, _q: any) {} // TODO: implement

    // getPlaylists
    // getSubscribers
    // getSubscriptions
    // subscribe
    // unsubscribe
    // getWatchHistory
    // clearWatchHistory
}
