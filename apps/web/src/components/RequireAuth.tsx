import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../lib/auth-context';
import { Spinner } from './Notice';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <Spinner />;
  if (state.status === 'signedOut') {
    return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return children;
}
