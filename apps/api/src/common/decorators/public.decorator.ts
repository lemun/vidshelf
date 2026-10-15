import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global JWT guard. A valid bearer token is still honoured when present,
 * so public routes can personalise their response (for example `likedByMe`).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
