import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResponse } from './types';

const user = { id: 'u1', username: 'alice', email: 'a@example.com', createdAt: '' };
const sessionFor = (accessToken: string): AuthResponse => ({
  user,
  accessToken,
  accessTokenExpiresIn: 900,
});
const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/** A fetch whose single response the test releases by hand; it never honours the abort signal. */
function deferredFetch() {
  let respond!: (res: Response) => void;
  let signal: AbortSignal | undefined;
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return new Promise<Response>((resolve) => (respond = resolve));
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    respond: (res: Response) => {
      respond(res);
    },
    signal: () => signal,
    fetchMock,
  };
}

/** Fresh module state (access token, epoch, in-flight refresh) for every test. */
async function loadApi() {
  vi.resetModules();
  const api = await import('./api');
  const seen: (string | null)[] = [];
  api.onSessionChange((s) => seen.push(s?.accessToken ?? null));
  return { ...api, seen };
}

describe('refreshSession and sign-out', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {}); // no Web Locks: the plain single-flight path
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies a refresh that completes normally', async () => {
    const { refreshSession, seen } = await loadApi();
    const http = deferredFetch();
    const pending = refreshSession();
    http.respond(ok(sessionFor('fresh')));
    expect((await pending)?.accessToken).toBe('fresh');
    expect(seen).toEqual(['fresh']);
  });

  it('cancels a refresh in flight at sign-out and ignores its late response', async () => {
    const { refreshSession, setSession, seen } = await loadApi();
    const http = deferredFetch();

    const pending = refreshSession();
    setSession(null); // the user signs out while the refresh is on the wire
    expect(http.signal()?.aborted).toBe(true);

    http.respond(ok(sessionFor('late'))); // the server answered anyway
    await expect(pending).resolves.toBeNull();
    expect(seen).toEqual([null]); // never signed back in
  });

  it('does not let a late refresh replace a newer sign-in', async () => {
    const { refreshSession, setSession, seen } = await loadApi();
    const http = deferredFetch();

    const pending = refreshSession();
    setSession(sessionFor('signed-in'));
    http.respond(ok(sessionFor('late')));

    await expect(pending).resolves.toBeNull();
    expect(seen).toEqual(['signed-in']);
  });

  it('starts a new refresh after sign-out instead of reusing the cancelled one', async () => {
    const { refreshSession, setSession } = await loadApi();
    const http = deferredFetch();

    const first = refreshSession();
    setSession(null);
    const second = refreshSession();
    expect(second).not.toBe(first);
    expect(http.fetchMock).toHaveBeenCalledTimes(2);
  });
});
