import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

import { User, UserSchema } from '../users/schemas/user.schema';
import { Settings, SettingsSchema } from './schemas/settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Settings.name, schema: SettingsSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
