/** The authenticated principal attached to `req.user` by the JWT strategy. */
export interface AuthUser {
  userId: string;
  username: string;
}
