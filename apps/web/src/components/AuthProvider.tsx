import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onSessionChange, refreshSession, setSession } from '../lib/api';
import { AuthContext, type AuthContextValue, type AuthState } from '../lib/auth-context';
import type { AuthResponse } from '../lib/types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  useEffect(() => {
    const unsubscribe = onSessionChange((session) => {
      setState(
        session ? { status: 'signedIn', user: session.user } : { status: 'signedOut', user: null },
      );
    });
    // Restore the session from the refresh cookie, if there is one.
    void refreshSession();
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setSession(
      await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),
    );
  }, []);

  const signUp = useCallback(async (username: string, email: string, password: string) => {
    setSession(
      await api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: { username, email, password },
      }),
    );
  }, []);

  const signOut = useCallback(async () => {
    // Signed out locally first: this cancels any refresh in flight and makes the app ignore its
    // response if it still arrives. The API then ends the session the cookie belongs to.
    setSession(null);
    await api<undefined>('/auth/logout', { method: 'POST' });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, signUp, signOut }),
    [state, signIn, signUp, signOut],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}
