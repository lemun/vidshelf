import mongoose, { Document } from 'mongoose';

export const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
});

export interface User extends Document {
  userId: any;
  username: string;
  password: string;
}
