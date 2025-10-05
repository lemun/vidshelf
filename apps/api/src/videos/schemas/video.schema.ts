import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReactionType = 'like' | 'dislike';

@Schema({ _id: true, timestamps: true })
export class Video {
    _id!: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', index: true, required: true })
    owner!: string;

    @Prop({ required: true, trim: true, maxLength: 120 })
    title!: string;

    @Prop({ MaxLength: 5000 })
    description?: string;

    @Prop() sourceUrl?: string;
    @Prop() thumbnailUrl?: string;

    @Prop({ default: 0, index: true }) views!: number;
    @Prop({ default: 0 }) likes!: number;
    @Prop({ default: 0 }) dislikes!: number;

    @Prop({
        type: [{ user: { type: Types.ObjectId, ref: 'User' }, type: { type: String, enum: ['like', 'dislike'] } } ],
        default: []
    })
    reactions!: { user: Types.ObjectId, type: ReactionType }[];
}

export type VideoDocument = HydratedDocument<Video>;
export const VideoSchema = SchemaFactory.createForClass(Video);
VideoSchema.index({ title: 'text', description: 'text' });
