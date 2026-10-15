import type { AuthResponse } from './types';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type SessionListener = (session: AuthResponse | null) => void;

let accessToken: string | null = null;
/**
 * Bumped whenever the session is replaced from outside a refresh (sign-in, sign-up, sign-out). A
 * refresh that started under an older epoch is cancelled, and its result is dropped if it still
 * arrives, so a late refresh response can never sign a signed-out user back in (or replace a
 * newer sign-in).
 */
let authEpoch = 0;
let refreshInFlight: { promise: Promise<AuthResponse | null>; controller: AbortController } | null =
  null;
const listeners = new Set<SessionListener>();

function applySession(session: AuthResponse | null): void {
  accessToken = session?.accessToken ?? null;
  for (const listener of listeners) listener(session);
}

/**
 * Replaces the session after sign-in, sign-up or sign-out, and cancels any refresh in flight.
 * The access token lives only in memory; the refresh token is an httpOnly cookie.
 */
export function setSession(session: AuthResponse | null): void {
  authEpoch += 1;
  refreshInFlight?.controller.abort();
  refreshInFlight = null;
  applySession(session);
}

/** Forgets the in-flight refresh, unless a newer one has replaced it already. */
function finishRefresh(controller: AbortController): void {
  if (refreshInFlight?.controller === controller) refreshInFlight = null;
}

export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Exchanges the refresh cookie for a new session. Refresh tokens are single-use and reuse revokes
 * every session, so refreshes should not race: calls in one tab share one in-flight request, and
 * the Web Locks API serialises refreshes across tabs (the next tab then sends the new cookie).
 * Where Web Locks is missing, two tabs can still send the same cookie at once; the API answers
 * the second one inside a short grace window instead of treating it as reuse.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  if (refreshInFlight) return refreshInFlight.promise;
  const epoch = authEpoch;
  const controller = new AbortController();
  const promise = (async () => {
    try {
      const run = async () => {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        return res.ok ? ((await res.json()) as AuthResponse) : null;
      };
      const session =
        typeof navigator !== 'undefined' && 'locks' in navigator
          ? await navigator.locks.request('vidshelf-refresh', { signal: controller.signal }, run)
          : await run();
      if (epoch !== authEpoch) return null; // signed in or out meanwhile: drop the result
      applySession(session);
      return session;
    } catch {
      if (epoch === authEpoch) applySession(null);
      return null;
    } finally {
      finishRefresh(controller);
    }
  })();
  refreshInFlight = { promise, controller };
  return promise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'same-origin',
    signal: options.signal,
  });
}

export async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join('. ');
    if (body.message) return body.message;
  } catch {
    // Not JSON; fall through.
  }
  return `Request failed (${res.status})`;
}

/** JSON request to the API. Retries once after a transparent refresh if the access token expired. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await send(path, options, accessToken);
  if (res.status === 401 && accessToken !== null) {
    const session = await refreshSession();
    if (session) res = await send(path, options, session.accessToken);
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
