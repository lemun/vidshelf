import type { User } from './schemas/user.schema';

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export function toPublicUser(
  user: Pick<User, '_id' | 'username' | 'email' | 'createdAt'>,
): PublicUser {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}
