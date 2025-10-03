import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from 'src/users/models/users.model';
import { ResetToken } from '../models/resettokens.model';

export class ResetTokenRepository {
  constructor(
    @InjectModel(ResetToken.name)
    private readonly resetTokenModel: Model<ResetToken>,
  ) {}

  async createToken(user: User, token: string): Promise<ResetToken> {
    return this.resetTokenModel.create({ user, token });
  }

  async getByTokenAndUser(
    user: User,
    token: string,
  ): Promise<ResetToken | null> {
    return this.resetTokenModel.findOne(
      { user, token },
      { projection: { password: 0 } },
    );
  }

  async updateTokensExpiryByUser(
    userId: string,
    isExpired: boolean,
  ): Promise<ResetToken | null> {
    return this.resetTokenModel.findOneAndUpdate(
      { user: new Types.ObjectId(userId) },
      { $set: { isExpired: isExpired } },
      { new: true, projection: { password: 0 } },
    );
  }
}
