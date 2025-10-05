import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { MinioModule } from './minio/minio.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    UsersModule,
    VideosModule,
    SettingsModule,
    MinioModule,
    DatabaseModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
