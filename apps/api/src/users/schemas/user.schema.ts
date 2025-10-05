import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: true, timestamps: true })
export class User {
    _id!: Types.ObjectId;

    @Prop({ unique: true, index: true, trim: true })
    username!: string;

    @Prop({ unique: true, index: true, lowercase: true, trim: true })
    email!: string;

    @Prop() passwordHash: string;

    @Prop() avatarUrl?: string;
    @Prop() bannerUrl?: string;
    @Prop({ maxLength: 300 }) about?: string;

    // subscribers!: Types.ObjectId[]
    // subscriptions!: Types.ObjectId[]
    // watchLater!: Types.ObjectId[]
    // history!: { video: Types.ObjectId, watchedAt: Date }[]
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ username: 'text' });
