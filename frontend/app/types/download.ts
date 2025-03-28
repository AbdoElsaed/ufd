export enum Platform {
  YOUTUBE = "youtube",
  FACEBOOK = "facebook",
  TWITTER = "twitter",
  INSTAGRAM = "instagram",
  TIKTOK = "tiktok",
  REDDIT = "reddit",
}

export enum Format {
  VIDEO = "video",
  AUDIO = "audio",
}

export enum Quality {
  HIGHEST = "highest",
  HD1080 = "1080p",
  HD720 = "720p",
  SD480 = "480p",
  SD360 = "360p",
}

export interface VideoFormat {
  quality: string;
  format: "video" | "audio";
  size?: string;
}

export interface VideoInfo {
  title: string;
  thumbnail?: string;
  duration?: number;
  formats: VideoFormat[];
}

export interface DownloadRequest {
  url: string;
  platform: Platform;
  format: Format;
  quality: Quality;
}

export interface DownloadResponse {
  url: string;
  filename: string;
  title: string;
  thumbnail?: string;
  content_type: string;
  size?: string | number;
  progress_url?: string;
}

export interface ErrorResponse {
  error: string;
  detail?: string;
} 