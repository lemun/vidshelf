import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  versionKey: false,
  timestamps: true,
})
export class User extends Document {
  @Prop({ type: String, required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ type: String, required: true })
  password: string;

  @Prop({ type: String, default: '' })
  bio: string;

  @Prop({ type: String, default: '' })
  avatarUrl: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
