import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * One row per issued refresh token. Only a SHA-256 hash of the token is stored. A token is
 * single-use: rotation sets `revokedAt`, and presenting a revoked token again is treated as theft
 * (all of that user's sessions are revoked).
 */
@Schema({ timestamps: true })
export class RefreshToken {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop() userAgent?: string;
  @Prop() ip?: string;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
// MongoDB removes rows once they expire; revoked rows live until then so reuse can be detected.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
