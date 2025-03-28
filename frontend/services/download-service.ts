import { Platform, Format, Quality, DownloadRequest, VideoInfo } from "@/app/types/download";

interface FormatOptions {
  format: string;
  videoQuality?: string;
  audioQuality?: string;
}

interface PlatformHandler {
  validateUrl: (url: string) => boolean;
  cleanUrl: (url: string) => string;
  getFormatOptions: (format: Format, quality: Quality) => FormatOptions;
}

class YouTubeHandler implements PlatformHandler {
  validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const isYouTubeDomain = hostname.includes("youtube.com") || hostname.includes("youtu.be");

      if (hostname.includes("youtube.com")) {
        // For youtube.com, require a video ID
        return isYouTubeDomain && !!urlObj.searchParams.get("v");
      } else if (hostname.includes("youtu.be")) {
        // For youtu.be, require a path (video ID)
        return isYouTubeDomain && urlObj.pathname.length > 1;
      }
      return false;
    } catch {
      return false;
    }
  }

  cleanUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes("youtu.be")) {
        const videoId = urlObj.pathname.slice(1);
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
      // Keep only essential parameters for YouTube URLs
      const videoId = urlObj.searchParams.get("v");
      if (!videoId) return url;
      return `https://www.youtube.com/watch?v=${videoId}`;
    } catch {
      return url;
    }
  }

  getFormatOptions(format: Format, quality: Quality): FormatOptions {
    if (format === Format.AUDIO) {
      return {
        format: "bestaudio",
        audioQuality: "best",
      };
    }

    const qualityMap: Record<Quality, string> = {
      [Quality.HIGHEST]: "best",
      [Quality.HD1080]: "1080",
      [Quality.HD720]: "720",
      [Quality.SD480]: "480",
      [Quality.SD360]: "360",
    };

    return {
      format: "video",
      videoQuality: qualityMap[quality] || "720",
    };
  }
}

class FacebookHandler implements PlatformHandler {
  validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      return hostname.includes("facebook.com") || hostname.includes("fb.watch");
    } catch {
      return false;
    }
  }

  cleanUrl(url: string): string {
    return url;
  }

  getFormatOptions(format: Format, quality: Quality): FormatOptions {
    return {
      format: format === Format.AUDIO ? "bestaudio" : "bestvideo",
      videoQuality: quality === Quality.HIGHEST ? "best" : quality.replace("p", ""),
    };
  }
}

// Add more platform handlers with proper implementations
const platformHandlers: Record<Platform, PlatformHandler> = {
  [Platform.YOUTUBE]: new YouTubeHandler(),
  [Platform.FACEBOOK]: new FacebookHandler(),
  [Platform.TWITTER]: {
    validateUrl: (url: string): boolean => {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return hostname.includes("twitter.com") || hostname.includes("x.com");
      } catch {
        return false;
      }
    },
    cleanUrl: (url: string) => url,
    getFormatOptions: (format: Format, quality: Quality): FormatOptions => ({
      format: format === Format.AUDIO ? "bestaudio" : "bestvideo",
      videoQuality: quality === Quality.HIGHEST ? "best" : quality.replace("p", ""),
    }),
  },
  [Platform.INSTAGRAM]: {
    validateUrl: (url: string): boolean => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname.includes("instagram.com");
      } catch {
        return false;
      }
    },
    cleanUrl: (url: string) => url,
    getFormatOptions: (format: Format, quality: Quality): FormatOptions => ({
      format: format === Format.AUDIO ? "bestaudio" : "bestvideo",
      videoQuality: quality === Quality.HIGHEST ? "best" : quality.replace("p", ""),
    }),
  },
  [Platform.TIKTOK]: {
    validateUrl: (url: string): boolean => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname.includes("tiktok.com");
      } catch {
        return false;
      }
    },
    cleanUrl: (url: string) => url,
    getFormatOptions: (format: Format, quality: Quality): FormatOptions => ({
      format: format === Format.AUDIO ? "bestaudio" : "bestvideo",
      videoQuality: quality === Quality.HIGHEST ? "best" : quality.replace("p", ""),
    }),
  },
  [Platform.REDDIT]: {
    validateUrl: (url: string): boolean => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname.includes("reddit.com");
      } catch {
        return false;
      }
    },
    cleanUrl: (url: string) => url,
    getFormatOptions: (format: Format, quality: Quality): FormatOptions => ({
      format: format === Format.AUDIO ? "bestaudio" : "bestvideo",
      videoQuality: quality === Quality.HIGHEST ? "best" : quality.replace("p", ""),
    }),
  },
};

export class DownloadService {
  private readonly API_BASE = "/api/download";

  detectPlatform(url: string): Platform | null {
    if (!url) return null;

    try {
      // Try to validate the URL first
      const urlObj = new URL(url);

      // Check each platform handler
      for (const [platform, handler] of Object.entries(platformHandlers)) {
        if (handler.validateUrl(url)) {  // Pass the full URL instead of just hostname
          return platform as Platform;
        }
      }

      // If no handler matched, try a simpler domain check
      const hostname = urlObj.hostname.toLowerCase();
      if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
        return Platform.YOUTUBE;
      } else if (hostname.includes("facebook.com") || hostname.includes("fb.watch")) {
        return Platform.FACEBOOK;
      } else if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
        return Platform.TWITTER;
      } else if (hostname.includes("instagram.com")) {
        return Platform.INSTAGRAM;
      } else if (hostname.includes("tiktok.com")) {
        return Platform.TIKTOK;
      } else if (hostname.includes("reddit.com")) {
        return Platform.REDDIT;
      }
    } catch (error) {
      console.error("Error detecting platform:", error);
    }
    return null;
  }

  async getVideoInfo(request: DownloadRequest): Promise<VideoInfo> {
    const handler = platformHandlers[request.platform];
    const cleanedUrl = handler.cleanUrl(request.url);

    const response = await fetch(`${this.API_BASE}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, url: cleanedUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || error.error || "Failed to get video information");
    }

    return response.json();
  }

  async downloadVideo(
    request: DownloadRequest,
    onProgress?: (progress: number) => void
  ): Promise<{ blob: Blob; filename: string }> {
    const handler = platformHandlers[request.platform];
    const cleanedUrl = handler.cleanUrl(request.url);

    console.log('Starting download with cleaned URL:', cleanedUrl);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.API_BASE}/start`, true);
      xhr.responseType = 'blob';
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 3600000; // 1 hour timeout

      // Setup progress handler with throttling
      let lastProgressUpdate = 0;
      xhr.onprogress = (event) => {
        const now = Date.now();
        // Only update progress every 100ms to avoid too frequent updates
        if (now - lastProgressUpdate > 100 && onProgress) {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(Math.min(99, percentComplete));
            console.log(`Download progress: ${percentComplete.toFixed(2)}%`);
          } else {
            // If length is not computable, use a simple counter based on bytes
            const megabytesLoaded = event.loaded / (1024 * 1024);
            const progress = Math.min(99, megabytesLoaded * 2); // Assume ~2% per MB
            onProgress(progress);
            console.log(`Downloaded: ${megabytesLoaded.toFixed(2)}MB`);
          }
          lastProgressUpdate = now;
        }
      };

      // Handle successful completion
      xhr.onload = () => {
        if (xhr.status === 200) {
          const blob = xhr.response;
          console.log('Download complete, blob:', {
            size: blob.size,
            type: blob.type
          });

          // Get filename from Content-Disposition header
          const contentDisposition = xhr.getResponseHeader('content-disposition');
          console.log('Content-Disposition:', contentDisposition);
          const filenameMatch = contentDisposition?.match(/filename="(.+?)"/);
          const filename = filenameMatch ? filenameMatch[1] : "download.mp4";

          if (onProgress) onProgress(100);
          resolve({ blob, filename });
        } else {
          console.error('Download failed with status:', xhr.status);
          reject(new Error(`Download failed with status: ${xhr.status}`));
        }
      };

      // Handle errors
      xhr.onerror = () => {
        console.error('Download failed');
        reject(new Error('Download failed'));
      };

      // Handle timeout
      xhr.ontimeout = () => {
        console.error('Download timed out');
        reject(new Error('Download timed out'));
      };

      // Handle abort
      xhr.onabort = () => {
        console.error('Download aborted');
        reject(new Error('Download aborted'));
      };

      // Send the request
      const body = JSON.stringify({ ...request, url: cleanedUrl });
      console.log('Sending request with body:', body);
      xhr.send(body);
    });
  }
}

export const downloadService = new DownloadService(); 