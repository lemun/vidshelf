import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RefreshToken {
    _id!: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', index: true, required: true })
    user!: Types.ObjectId;

    @Prop({ required: true })
    tokenHash!: string;

    @Prop() userAgent?: string;
    @Prop() ip?: string;

    @Prop({ default: false })
    revoked!: boolean;

    @Prop({ type: Date, index: true })
    expiresAt!: Date;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
RefreshTokenSchema.index({ user: 1, tokenHash: 1 }, { unique: true });
