import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { User } from '../models/users.model';

@Injectable()
export class UserRepository {
  constructor(@InjectModel('User') private readonly userModel: Model<User>) {}

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).lean();
  }

  async getUsers(filterQuery: FilterQuery<User>): Promise<User[]> {
    return this.userModel
      .find(filterQuery, { password: 0 })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getSingleUser(filterQuery: FilterQuery<User>): Promise<User | null> {
    return this.userModel
      .findOne(filterQuery, { projection: { password: 0 } })
      .lean();
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userModel
      .findOne({ _id: new Types.ObjectId(id) }, { projection: { password: 0 } })
      .lean();
  }

  async updateUserById(
    id: string,
    updateQuery: Partial<User>,
  ): Promise<User | null> {
    return this.userModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id) },
        { $set: updateQuery },
        { new: true, projection: { password: 0 } },
      )
      .lean();
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = new this.userModel(user);
    return newUser.save();
  }

  async deleteUserById(id: string): Promise<User | null> {
    return this.userModel
      .findOneAndDelete(
        { _id: new Types.ObjectId(id) },
        { projection: { password: 0 } },
      )
      .lean();
  }
}
