import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * One document per sign-in ("token family"). It holds the SHA-256 hash of the only refresh token
 * that is currently valid for that session, never the token itself.
 *
 * Rotation and revocation are each one conditional update of this single document, so they are
 * atomic with respect to each other: a rotation only succeeds while `revokedAt` is null and the
 * presented token is the current one, and a revocation covers whichever token is current at that
 * moment. A replacement token can therefore never outlive a revocation of its session.
 */
@Schema({ timestamps: true })
export class RefreshSession {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  /** Hash of the current refresh token. Every rotation replaces it. */
  @Prop({ required: true, unique: true })
  tokenHash!: string;

  /** Rotation counter, carried in the token as `gen`. An older `gen` means a spent token. */
  @Prop({ required: true, default: 0 })
  generation!: number;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop() userAgent?: string;
  @Prop() ip?: string;
}

export type RefreshSessionDocument = HydratedDocument<RefreshSession>;
export const RefreshSessionSchema = SchemaFactory.createForClass(RefreshSession);
// MongoDB removes sessions once they expire; revoked ones live until then so reuse is still detected.
RefreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
