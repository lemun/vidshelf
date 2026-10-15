import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ErrorNotice, Spinner } from '../components/Notice';
import { Thumbnail } from '../components/VideoCard';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { formatBytes, formatCount, timeAgo } from '../lib/format';
import type { VideoDetail, VideoPage, VideoSummary } from '../lib/types';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string; notFound: boolean }
  | { status: 'ready'; video: VideoDetail };

/** A finished request, tagged with the id + viewer it was made for. */
type Result = Exclude<Load, { status: 'loading' }> & { key: string };

export function WatchPage() {
  const { id = '' } = useParams();
  const { state: auth } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<Result | null>(null);
  const [more, setMore] = useState<VideoSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const viewCountedFor = useRef<string | null>(null);

  // Re-fetch when the signed-in user changes so `likedByMe` is right.
  const viewerId = auth.status === 'signedIn' ? auth.user.id : null;
  const authReady = auth.status !== 'loading';
  const key = `${id}:${viewerId ?? ''}`;
  const load: Load = authReady && result?.key === key ? result : { status: 'loading' };

  useEffect(() => {
    if (!authReady) return;
    const controller = new AbortController();
    api<VideoDetail>(`/videos/${id}`, { signal: controller.signal })
      .then((video) => {
        setResult({ key, status: 'ready', video });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const notFound =
          error instanceof ApiError && (error.status === 404 || error.status === 400);
        setResult({ key, status: 'error', message: (error as Error).message, notFound });
      });
    api<VideoPage>('/videos?limit=9', { signal: controller.signal })
      .then((page) => {
        setMore(page.items.filter((v) => v.id !== id).slice(0, 8));
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
    };
  }, [id, key, authReady]);

  if (load.status === 'loading') return <Spinner label="Loading video" />;
  if (load.status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <title>Video unavailable · Vidshelf</title>
        {load.notFound ? (
          <p className="text-zinc-600">This video does not exist or was deleted.</p>
        ) : (
          <ErrorNotice>Could not load the video: {load.message}</ErrorNotice>
        )}
        <Link to="/" className="mt-6 inline-block font-medium text-indigo-600 hover:underline">
          Back to all videos
        </Link>
      </div>
    );
  }

  const { video } = load;
  const isOwner = viewerId === video.owner.id;
  const update = (patch: Partial<VideoDetail>) => {
    setResult((prev) =>
      prev?.status === 'ready' ? { ...prev, video: { ...prev.video, ...patch } } : prev,
    );
  };

  const countView = () => {
    if (viewCountedFor.current === video.id) return;
    viewCountedFor.current = video.id;
    api<{ views: number }>(`/videos/${video.id}/views`, { method: 'POST' })
      .then(({ views }) => {
        update({ views });
      })
      .catch(() => undefined);
  };

  const toggleLike = async () => {
    if (auth.status !== 'signedIn') {
      void navigate(`/signin?next=${encodeURIComponent(`/watch/${video.id}`)}`);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const result = await api<{ likes: number; likedByMe: boolean }>(`/videos/${video.id}/like`, {
        method: video.likedByMe ? 'DELETE' : 'PUT',
      });
      update(result);
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${video.title}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api<undefined>(`/videos/${video.id}`, { method: 'DELETE' });
      void navigate('/');
    } catch (error) {
      setActionError((error as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <title>{`${video.title} · Vidshelf`}</title>
      <section>
        <div className="overflow-hidden rounded-xl bg-black">
          <video
            key={video.id}
            src={video.streamUrl}
            poster={video.thumbnailUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            onPlay={countView}
            className="aspect-video w-full"
            data-testid="player"
          />
        </div>

        <h1 className="mt-4 text-xl font-semibold text-zinc-900">{video.title}</h1>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-indigo-100 font-semibold text-indigo-700 uppercase">
              {video.owner.username.slice(0, 1)}
            </span>
            <div>
              <p className="font-medium text-zinc-900">{video.owner.username}</p>
              <p className="text-xs text-zinc-500">Uploaded {timeAgo(video.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void toggleLike()}
              disabled={busy}
              aria-pressed={video.likedByMe}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                video.likedByMe
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
              }`}
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M2 21h4V9H2v12zm20-11a2 2 0 0 0-2-2h-6.3l1-4.6v-.3a1.5 1.5 0 0 0-.4-1L13.2 1 6.6 7.6A2 2 0 0 0 6 9v10a2 2 0 0 0 2 2h9a2 2 0 0 0 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7v-2z"
                />
              </svg>
              <span data-testid="like-count">{formatCount(video.likes, 'like')}</span>
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="rounded-full px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="mt-3">
            <ErrorNotice>{actionError}</ErrorNotice>
          </div>
        )}

        <div className="mt-4 rounded-xl bg-zinc-100 p-4 text-sm text-zinc-800">
          <p className="font-medium" data-testid="view-count">
            {formatCount(video.views, 'view')} · {formatBytes(video.sizeBytes)}
          </p>
          {video.description ? (
            <p className="mt-2 whitespace-pre-line">{video.description}</p>
          ) : (
            <p className="mt-2 text-zinc-500">No description.</p>
          )}
        </div>
      </section>

      <aside aria-label="More videos" className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">More videos</h2>
        {more.length === 0 && <p className="text-sm text-zinc-500">Nothing else yet.</p>}
        {more.map((v) => (
          <Link key={v.id} to={`/watch/${v.id}`} className="group flex gap-3">
            <Thumbnail video={v} className="w-40 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium text-zinc-900">{v.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{v.owner.username}</p>
              <p className="text-xs text-zinc-500">{formatCount(v.views, 'view')}</p>
            </div>
          </Link>
        ))}
      </aside>
    </div>
  );
}
