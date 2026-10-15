import { Link, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth-context';
import { Logo } from './Logo';
import { SearchBox } from './SearchBox';

export function Header() {
  const { state, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Logo />
        <div className="flex flex-1 justify-center">
          <SearchBox />
        </div>
        <nav className="flex shrink-0 items-center gap-2 text-sm">
          {state.status === 'signedIn' ? (
            <>
              <Link
                to="/upload"
                className="rounded-full bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500"
              >
                Upload
              </Link>
              <span
                className="hidden items-center gap-2 pl-2 text-zinc-700 md:flex"
                data-testid="current-user"
              >
                <span className="grid size-8 place-items-center rounded-full bg-indigo-100 font-semibold text-indigo-700 uppercase">
                  {state.user.username.slice(0, 1)}
                </span>
                {state.user.username}
              </span>
              <button
                type="button"
                onClick={() => {
                  void signOut().then(() => navigate('/'));
                }}
                className="rounded-full px-3 py-2 text-zinc-600 hover:bg-zinc-100"
              >
                Sign out
              </button>
            </>
          ) : state.status === 'signedOut' ? (
            <>
              <Link to="/signin" className="rounded-full px-3 py-2 text-zinc-700 hover:bg-zinc-100">
                Sign in
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500"
              >
                Sign up
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
