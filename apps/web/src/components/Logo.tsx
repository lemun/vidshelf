import { Link } from 'react-router';

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Vidshelf home">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-indigo-600" />
        <path d="M12 9.5v11l9-5.5z" className="fill-white" />
        <rect x="8" y="24" width="16" height="2" rx="1" className="fill-indigo-200" />
      </svg>
      <span className="hidden text-lg font-semibold tracking-tight text-zinc-900 sm:inline">
        Vidshelf
      </span>
    </Link>
  );
}
