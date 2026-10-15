import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Video {
  _id!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  title!: string;

  @Prop({ default: '', maxlength: 5000 })
  description!: string;

  /** Object key in the bucket, e.g. `videos/<userId>/<uuid>.mp4`. */
  @Prop({ required: true, unique: true })
  videoKey!: string;

  @Prop({ type: String, default: null })
  thumbnailKey!: string | null;

  @Prop({ required: true })
  contentType!: string;

  @Prop({ required: true, min: 1 })
  sizeBytes!: number;

  @Prop({ type: Number, default: null, min: 0 })
  durationSeconds!: number | null;

  @Prop({ default: 0, min: 0 })
  views!: number;

  @Prop({ default: 0, min: 0 })
  likes!: number;

  /** Who liked it. Never returned to clients; used for idempotent like/unlike and `likedByMe`. */
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'User' }], default: [], select: false })
  likedBy!: Types.ObjectId[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type VideoDocument = HydratedDocument<Video>;
export const VideoSchema = SchemaFactory.createForClass(Video);
VideoSchema.index({ createdAt: -1 });
VideoSchema.index(
  { title: 'text', description: 'text' },
  { weights: { title: 5, description: 1 } },
);
