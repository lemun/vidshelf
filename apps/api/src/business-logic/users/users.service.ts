import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './users.schema';

@Injectable()
export class UsersService {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  constructor(@InjectModel('User') private userSchema: Model<User>) {}

  getUsers(): Promise<User[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.userSchema.find().lean().exec();
  }

  getUserById(id: string): Promise<User | null> {
    return this.userSchema.findById(id).lean().exec();
  }

  createUser(user: User): Promise<User> {
    return this.userSchema.create(user);
  }
}
