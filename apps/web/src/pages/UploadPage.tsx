import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';
import { ErrorNotice } from '../components/Notice';
import { api } from '../lib/api';
import { formatBytes, formatDuration } from '../lib/format';
import { inspectVideo, uploadToStorage, type VideoFacts } from '../lib/media';
import type { UploadTarget, VideoDetail } from '../lib/types';

const ACCEPTED = ['video/mp4', 'video/webm'];

type Phase =
  | { step: 'idle' }
  | { step: 'uploading'; progress: number }
  | { step: 'publishing' }
  | { step: 'error'; message: string };

export function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [facts, setFacts] = useState<VideoFacts | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const working = phase.step === 'uploading' || phase.step === 'publishing';

  const choose = async (chosen: File | undefined) => {
    setPhase({ step: 'idle' });
    setFacts(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (!chosen) {
      setFile(null);
      return;
    }
    if (!ACCEPTED.includes(chosen.type)) {
      setFile(null);
      setPhase({ step: 'error', message: 'Choose an MP4 or WebM video.' });
      return;
    }
    setFile(chosen);
    if (!title) setTitle(chosen.name.replace(/\.[^.]+$/, '').slice(0, 120));
    const inspected = await inspectVideo(chosen);
    setFacts(inspected);
    if (inspected.thumbnail) setPreview(URL.createObjectURL(inspected.thumbnail));
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    try {
      setPhase({ step: 'uploading', progress: 0 });
      const videoTarget = await api<UploadTarget>('/videos/uploads', {
        method: 'POST',
        body: { kind: 'video', contentType: file.type, sizeBytes: file.size },
      });
      await uploadToStorage(videoTarget, file, (progress) => {
        setPhase({ step: 'uploading', progress });
      });

      let thumbnailKey: string | undefined;
      if (facts?.thumbnail) {
        const thumbTarget = await api<UploadTarget>('/videos/uploads', {
          method: 'POST',
          body: { kind: 'thumbnail', contentType: 'image/jpeg', sizeBytes: facts.thumbnail.size },
        });
        await uploadToStorage(thumbTarget, facts.thumbnail);
        thumbnailKey = thumbTarget.key;
      }

      setPhase({ step: 'publishing' });
      const video = await api<VideoDetail>('/videos', {
        method: 'POST',
        body: {
          title,
          description: description || undefined,
          videoKey: videoTarget.key,
          thumbnailKey,
          durationSeconds: facts?.durationSeconds ?? undefined,
        },
      });
      void navigate(`/watch/${video.id}`);
    } catch (error) {
      setPhase({ step: 'error', message: (error as Error).message });
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <title>Upload · Vidshelf</title>
      <h1 className="text-2xl font-semibold text-zinc-900">Upload a video</h1>
      <p className="mt-1 text-sm text-zinc-600">
        MP4 or WebM. The file goes straight to storage; a poster frame is taken in your browser.
      </p>

      <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-5">
        <label
          htmlFor="file"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center hover:border-indigo-400"
        >
          {preview ? (
            <img
              src={preview}
              alt="Poster frame"
              className="aspect-video w-64 rounded-lg object-cover"
            />
          ) : (
            <svg viewBox="0 0 24 24" className="size-10 text-zinc-400" aria-hidden="true">
              <path
                fill="currentColor"
                d="M11 16V7.8l-2.6 2.6L7 9l5-5 5 5-1.4 1.4L13 7.8V16h-2zm-6 4a2 2 0 0 1-2-2v-3h2v3h14v-3h2v3a2 2 0 0 1-2 2H5z"
              />
            </svg>
          )}
          <span className="text-sm font-medium text-zinc-800">
            {file ? file.name : 'Choose a video file'}
          </span>
          {file && (
            <span className="text-xs text-zinc-500">
              {formatBytes(file.size)}
              {facts?.durationSeconds ? ` · ${formatDuration(facts.durationSeconds)}` : ''}
            </span>
          )}
          <input
            id="file"
            type="file"
            accept={ACCEPTED.join(',')}
            className="sr-only"
            disabled={working}
            onChange={(e) => void choose(e.target.files?.[0])}
          />
        </label>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-800">
            Title
          </label>
          <input
            id="title"
            required
            maxLength={120}
            value={title}
            disabled={working}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-zinc-800">
            Description <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <textarea
            id="description"
            rows={4}
            maxLength={5000}
            value={description}
            disabled={working}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {phase.step === 'error' && <ErrorNotice>{phase.message}</ErrorNotice>}

        {phase.step === 'uploading' && (
          <div aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full bg-indigo-600 transition-[width]"
                style={{ width: `${Math.round(phase.progress * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Uploading… {Math.round(phase.progress * 100)}%
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={!file || !title.trim() || working}
          className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase.step === 'publishing'
            ? 'Publishing…'
            : phase.step === 'uploading'
              ? 'Uploading…'
              : 'Publish'}
        </button>
      </form>
    </div>
  );
}
