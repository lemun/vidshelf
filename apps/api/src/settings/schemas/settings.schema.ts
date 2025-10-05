import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: true, timestamps: true })
export class Settings {
    _id!: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', unique: true, index: true, required: true })
    user!: Types.ObjectId;

    @Prop({ default: 'en' })
    language!: string;
}

export type SettingsDocument = HydratedDocument<Settings>;
export const SettingsSchema = SchemaFactory.createForClass(Settings);
