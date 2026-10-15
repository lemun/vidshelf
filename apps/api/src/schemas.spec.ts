import { RefreshSessionSchema } from './auth/schemas/refresh-session.schema';
import { VideoSchema } from './videos/schemas/video.schema';

/**
 * `@Prop({ type: Types.ObjectId })` (the bson class) silently becomes a Mixed path in
 * @nestjs/mongoose, so string ids in filters are not cast and never match. References must use
 * `SchemaTypes.ObjectId`.
 */
describe('schema references', () => {
  it.each([
    ['RefreshSession.user', RefreshSessionSchema.path('user').instance],
    ['Video.owner', VideoSchema.path('owner').instance],
    ['Video.likedBy[]', VideoSchema.path('likedBy.$')?.instance],
  ])('%s is an ObjectId path', (_name, instance) => {
    expect(instance).toBe('ObjectId');
  });
});
