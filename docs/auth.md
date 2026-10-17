# Authentication design

How sign-in, refresh-token rotation and sign-out work in Vidshelf. Summary in [the README](../README.md#design-notes).

The access token is a 15-minute JWT that the web app keeps only in memory. The refresh
token is a 7-day JWT in an `httpOnly`, `SameSite=Strict` cookie scoped to `/api/auth`.

- Each sign-in starts a session: one MongoDB document that stores the SHA-256 hash of the only
  refresh token currently valid for it (never the token), a rotation counter and `revokedAt`.
- A refresh succeeds only through one conditional update of that document: "this session is not
  revoked or expired and its current token is the one presented" → "store the replacement's
  hash". So each refresh token works once.
- Presenting a token from an older generation of its session (one that was already used) is
  treated as theft: that session and every other active session of the user are revoked.
- **Two-tab grace window.** Tabs share one cookie, so two tabs can refresh with the same token
  at once (the web app serialises refreshes with the Web Locks API, but not every client has
  it). The token the last rotation consumed is therefore accepted again for 10 seconds after
  that rotation, once, while the session is live: the answer is a new access token and no new
  cookie, because the winning request already set it. Outside that window, a second time, or
  any older token, it is reuse as above. The cost: a thief replaying a just-rotated token
  within those 10 seconds gets one access token (15 minutes) instead of triggering revocation.
- **Sign-out** ends the session the cookie's token belongs to, identified by the token's
  signature, session id and generation (the current token or the one just replaced), not by
  looking up its hash. So it still works if a refresh replaced the token a moment earlier.
- Revoking (reuse or sign-out) is also a single-document update, so it cannot be outrun by a
  refresh in flight at the same moment: that refresh either stored its replacement first (and
  the replacement is revoked with the session), or it finds the session revoked and fails
  without returning a token. `auth.service.spec.ts` interleaves the two to check this.
- In the web app, signing out cancels any refresh in flight and ignores its response if it
  still arrives (an "auth epoch" counter), so a late refresh cannot sign the user back in.
- Access tokens that were already issued stay valid until they expire (at most 15 minutes).
  Sessions started by a new sign-in after a revocation are not affected.
- Every route requires a token unless it is marked `@Public()`. Public routes still read a
  valid token if one is sent, which is how `likedByMe` works for signed-in viewers.
- `/api/auth/*` is rate limited per IP.
