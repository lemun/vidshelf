import { Link } from 'react-router';
import { formatCount, formatDuration, timeAgo } from '../lib/format';
import type { VideoSummary } from '../lib/types';

export function Thumbnail({ video, className = '' }: { video: VideoSummary; className?: string }) {
  return (
    <div className={`relative aspect-video overflow-hidden rounded-xl bg-zinc-200 ${className}`}>
      {video.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="grid size-full place-items-center text-zinc-400">
          <svg viewBox="0 0 24 24" className="size-10" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        </div>
      )}
      {video.durationSeconds !== null && (
        <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
          {formatDuration(video.durationSeconds)}
        </span>
      )}
    </div>
  );
}

export function VideoCard({ video }: { video: VideoSummary }) {
  return (
    <article>
      <Link to={`/watch/${video.id}`} className="group block" data-testid="video-card">
        <Thumbnail video={video} />
        <div className="mt-3 flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600 uppercase">
            {video.owner.username.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm leading-snug font-medium text-zinc-900">
              {video.title}
            </h3>
            <p className="mt-1 text-xs text-zinc-500">{video.owner.username}</p>
            <p className="text-xs text-zinc-500">
              {formatCount(video.views, 'view')} · {timeAgo(video.createdAt)}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
