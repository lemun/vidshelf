/** Shapes returned to clients (internal fields such as object keys and `likedBy` stay private). */
export interface VideoSummary {
  id: string;
  title: string;
  owner: { id: string; username: string };
  views: number;
  likes: number;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

export interface VideoDetail extends VideoSummary {
  description: string;
  contentType: string;
  sizeBytes: number;
  streamUrl: string;
  likedByMe: boolean;
}

export interface VideoPage {
  items: VideoSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface UploadTarget {
  key: string;
  url: string;
  fields: Record<string, string>;
  maxBytes: number;
  expiresAt: string;
}
