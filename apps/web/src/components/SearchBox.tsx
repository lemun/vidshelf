import { useState, type SubmitEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export function SearchBox() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const current = params.get('q') ?? '';
  const [query, setQuery] = useState(current);
  const [synced, setSynced] = useState(current);

  // Keep the box in step with the URL (back/forward, clicking the logo).
  if (current !== synced) {
    setSynced(current);
    setQuery(current);
  }

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = query.trim();
    void navigate(q ? `/?q=${encodeURIComponent(q)}` : '/');
  };

  return (
    <form role="search" onSubmit={submit} className="flex w-full max-w-xl">
      <label htmlFor="search" className="sr-only">
        Search videos
      </label>
      <input
        id="search"
        type="search"
        placeholder="Search videos"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        className="h-10 min-w-0 flex-1 rounded-l-full border border-zinc-300 bg-white px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
      />
      <button
        type="submit"
        className="h-10 rounded-r-full border border-l-0 border-zinc-300 bg-zinc-50 px-5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
      >
        Search
      </button>
    </form>
  );
}
