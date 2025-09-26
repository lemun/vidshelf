import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './users.schema';

@Injectable()
export class UsersService {
  private users: User[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  constructor(@InjectModel('User') private userSchema: Model<User>) {}

  getUsers(): User[] {
    return [...this.users];
  }

  private findUser(id: string): [string, number] {
    const userIndex = this.users.findIndex((user) => user.userId === id);
    const user = this.users[userIndex];
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return [user.username, userIndex];
  }
}
