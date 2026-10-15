import { useState, type SubmitEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { ErrorNotice } from '../components/Notice';
import { useAuth } from '../lib/auth-context';

/** Only same-app paths are allowed as a post-login redirect. */
function safeNext(next: string | null): string {
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/';
}

const inputClass =
  'mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

export function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const { state, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (state.status === 'signedIn' && !submitting) return <Navigate to={next} replace />;

  const isSignup = mode === 'signup';
  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isSignup) await signUp(username.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
      void navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  const otherQuery = next === '/' ? '' : `?next=${encodeURIComponent(next)}`;

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <title>{isSignup ? 'Create account · Vidshelf' : 'Sign in · Vidshelf'}</title>
      <h1 className="text-2xl font-semibold text-zinc-900">
        {isSignup ? 'Create your account' : 'Welcome back'}
      </h1>
      <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
        {isSignup && (
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-zinc-800">
              Username
            </label>
            <input
              id="username"
              required
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_.\-]+"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
              }}
              className={inputClass}
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-800">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-800">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={isSignup ? 8 : 1}
            maxLength={72}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            className={inputClass}
          />
          {isSignup && (
            <p className="mt-1 text-xs text-zinc-500">
              At least 8 characters, with a letter and a number.
            </p>
          )}
        </div>
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {isSignup ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-600">
        {isSignup ? 'Already have an account? ' : 'New here? '}
        <Link
          to={`${isSignup ? '/signin' : '/signup'}${otherQuery}`}
          className="font-medium text-indigo-600 hover:underline"
        >
          {isSignup ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </div>
  );
}
