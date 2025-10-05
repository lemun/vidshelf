import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Settings, SettingsDocument } from './schemas/settings.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name) private readonly settingsModel: Model<SettingsDocument>,
    @InjectModel('User') private readonly userModel: Model<any>,
  ) {}

  async get(_userId: string) {
    return { settings: null }; // TODO: find or create default settings for user
  }

  async update(_userId: string, _dto: UpdateSettingsDto) {
    return { settings: null }; // TODO: upsert settings for user
  }

  async changePassword(_userId: string, _dto: ChangePasswordDto) {
    return { success: true }; // TODO: verify curr pass, hash & set new pass on User, optionally revoke refresh tokens
  }

  async changeEmail(_userId: string, _dto: ChangeEmailDto) {
    return { success: true }; // TODO: ensure email available, set email (not verification at this time)
  }
}
