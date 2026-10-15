export interface VideoFacts {
  durationSeconds: number | null;
  thumbnail: Blob | null;
}

/**
 * Reads duration and grabs a poster frame in the browser, so the server needs no ffmpeg.
 * Best effort: a codec the browser cannot decode yields `null`s instead of an error.
 */
export async function inspectVideo(file: File): Promise<VideoFacts> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  const once = (event: string) =>
    new Promise<void>((resolve, reject) => {
      video.addEventListener(
        event,
        () => {
          resolve();
        },
        { once: true },
      );
      video.addEventListener(
        'error',
        () => {
          reject(new Error('cannot decode video'));
        },
        { once: true },
      );
    });

  try {
    await once('loadedmetadata');
    const duration = Number.isFinite(video.duration) ? video.duration : null;

    video.currentTime = duration ? Math.min(1, duration / 3) : 0;
    await once('seeked');

    const width = 640;
    const height = Math.round((width * (video.videoHeight || 9)) / (video.videoWidth || 16));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(video, 0, 0, width, height);
    const thumbnail = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.82);
    });
    return { durationSeconds: duration, thumbnail };
  } catch {
    return { durationSeconds: null, thumbnail: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** POSTs a file to MinIO with a presigned policy, reporting progress (fetch cannot). */
export function uploadToStorage(
  target: { url: string; fields: Record<string, string> },
  file: Blob,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const form = new FormData();
  for (const [name, value] of Object.entries(target.fields)) form.append(name, value);
  form.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', target.url);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage rejected the upload (${xhr.status})`));
    });
    xhr.addEventListener('error', () => {
      reject(new Error('Could not reach storage'));
    });
    xhr.send(form);
  });
}
