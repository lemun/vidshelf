import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  /** Includes `passwordHash`, for credential checks only. */
  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+passwordHash').exec();
  }

  async existsByEmailOrUsername(email: string, username: string): Promise<boolean> {
    const found = await this.userModel
      .exists({ $or: [{ email: email.toLowerCase() }, { username }] })
      .exec();
    return found !== null;
  }

  create(data: { username: string; email: string; passwordHash: string }): Promise<UserDocument> {
    return this.userModel.create(data);
  }
}
