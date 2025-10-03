import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { User } from 'src/users/models/users.model';

@Schema({
  versionKey: false,
  timestamps: true,
})
export class ResetToken extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ type: String, required: true })
  token: string;

  @Prop({ type: Number, default: new Date(Date.now() + 24 * 60 * 60 * 1000) })
  expiresAt: number;

  @Prop({ type: Boolean, default: false })
  isExpired: boolean;
}

export const ResetTokenSchema = SchemaFactory.createForClass(ResetToken);
