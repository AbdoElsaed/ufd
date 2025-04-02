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

interface PlatformCookies {
  [key: string]: string[];
}

// Cookie names to extract for each platform
const PLATFORM_COOKIES: PlatformCookies = {
  youtube: [
    'LOGIN_INFO',
    'CONSENT',
    'VISITOR_INFO1_LIVE',
    'YSC',
    'PREF',
    'SID',
    'HSID',
    'SSID',
    'APISID',
    'SAPISID',
    '__Secure-1PSID',
    '__Secure-3PSID',
    '__Secure-1PAPISID',
    '__Secure-3PAPISID',
  ],
  facebook: ['c_user', 'xs', 'fr', 'datr', 'sb'],
  twitter: ['auth_token', 'ct0', 'twid', '_twitter_sess'],
  instagram: ['sessionid', 'ds_user_id', 'csrftoken', 'ig_did', 'mid'],
  reddit: ['reddit_session', 'token', 'csrf_token'],
  tiktok: ['sessionid', 'tt_webid', 'tt_webid_v2', 'sid_tt']
};

export class DownloadService {
  private readonly API_BASE: string;

  constructor() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      throw new Error('API URL not configured');
    }
    this.API_BASE = `${apiUrl}/download`;
    console.log('API Base URL:', this.API_BASE);
  }

  private async getPlatformCookies(platform: Platform): Promise<string> {
    try {
      const cookieNames = PLATFORM_COOKIES[platform.toLowerCase()];
      if (!cookieNames) return '';

      const cookies = document.cookie
        .split(';')
        .map(cookie => cookie.trim())
        .filter(cookie => {
          const cookieName = cookie.split('=')[0];
          return cookieNames.some(name => 
            cookieName === name || 
            cookieName.startsWith(`${name}=`) || 
            cookieName.startsWith(`__Secure-${name}=`) || 
            cookieName.startsWith(`__Host-${name}=`)
          );
        })
        .join('; ');

      console.log(`Got ${platform} cookies:`, cookies ? 'Found' : 'None');
      return cookies;
    } catch (error) {
      console.warn(`Failed to get ${platform} cookies:`, error);
      return '';
    }
  }

  detectPlatform(url: string): Platform | null {
    if (!url) return null;

    try {
      const urlObj = new URL(url);
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
    const cookies = await this.getPlatformCookies(request.platform);
    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (cookies) {
      headers["X-Platform-Cookies"] = cookies;
    }

    console.log('Getting video info from:', `${this.API_BASE}/info`);
    const response = await fetch(`${this.API_BASE}/info`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
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
    const cookies = await this.getPlatformCookies(request.platform);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.API_BASE}/start`, true);
      xhr.responseType = 'blob';
      xhr.setRequestHeader('Content-Type', 'application/json');
      
      if (cookies) {
        xhr.setRequestHeader('X-Platform-Cookies', cookies);
      }

      xhr.timeout = 3600000; // 1 hour timeout

      // Progress handling with throttling
      let lastProgressUpdate = 0;
      xhr.onprogress = (event) => {
        const now = Date.now();
        if (now - lastProgressUpdate > 100 && onProgress) {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(Math.min(99, percentComplete));
          } else {
            const megabytesLoaded = event.loaded / (1024 * 1024);
            const progress = Math.min(99, megabytesLoaded * 2);
            onProgress(progress);
          }
          lastProgressUpdate = now;
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const blob = xhr.response;
          const contentDisposition = xhr.getResponseHeader('content-disposition');
          const filenameMatch = contentDisposition?.match(/filename="(.+?)"/);
          const filename = filenameMatch ? filenameMatch[1] : "download.mp4";

          if (onProgress) onProgress(100);
          resolve({ blob, filename });
        } else {
          reject(new Error(`Download failed with status: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Download failed'));
      xhr.ontimeout = () => reject(new Error('Download timed out'));
      xhr.onabort = () => reject(new Error('Download aborted'));

      xhr.send(JSON.stringify(request));
    });
  }
}

export const downloadService = new DownloadService(); 