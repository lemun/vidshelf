import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorNotice, Spinner } from '../components/Notice';
import { VideoCard } from '../components/VideoCard';
import { api } from '../lib/api';
import type { VideoPage, VideoSummary } from '../lib/types';

const PAGE_SIZE = 24;

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: VideoSummary[]; total: number; page: number };

/** A finished request, tagged with the query it answered. */
type Result = Exclude<Load, { status: 'loading' }> & { q: string };

export function HomePage() {
  const [params] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const [result, setResult] = useState<Result | null>(null);
  // Anything fetched for a different query is stale: show loading until the new one lands.
  const load: Load = result?.q === q ? result : { status: 'loading' };
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (q) query.set('q', q);
    api<VideoPage>(`/videos?${query.toString()}`, { signal: controller.signal })
      .then((page) => {
        setResult({ q, status: 'ready', items: page.items, total: page.total, page: 1 });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ q, status: 'error', message: (error as Error).message });
        }
      });
    return () => {
      controller.abort();
    };
  }, [q]);

  const loadMore = async () => {
    if (load.status !== 'ready') return;
    setLoadingMore(true);
    try {
      const query = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(load.page + 1) });
      if (q) query.set('q', q);
      const next = await api<VideoPage>(`/videos?${query.toString()}`);
      setResult({
        q,
        status: 'ready',
        items: [...load.items, ...next.items],
        total: next.total,
        page: next.page,
      });
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <title>{q ? `${q} · Vidshelf` : 'Vidshelf'}</title>
      {q && (
        <h1 className="mb-5 text-lg font-semibold text-zinc-900">
          Results for “{q}”
          {load.status === 'ready' && (
            <span className="ml-2 text-sm font-normal text-zinc-500">{load.total} found</span>
          )}
        </h1>
      )}

      {load.status === 'loading' && <Spinner label="Loading videos" />}
      {load.status === 'error' && <ErrorNotice>Could not load videos: {load.message}</ErrorNotice>}
      {load.status === 'ready' && load.items.length === 0 && (
        <div className="py-20 text-center text-zinc-600">
          {q ? (
            <p>No videos match “{q}”.</p>
          ) : (
            <p>
              No videos yet.{' '}
              <Link to="/upload" className="font-medium text-indigo-600 hover:underline">
                Upload the first one
              </Link>
              .
            </p>
          )}
        </div>
      )}
      {load.status === 'ready' && load.items.length > 0 && (
        <>
          <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {load.items.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
          {load.items.length < load.total && (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
