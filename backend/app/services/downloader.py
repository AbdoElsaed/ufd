from typing import Optional, Dict, Any
import yt_dlp
import asyncio
from pathlib import Path
import json
import logging
from ..core.config import get_settings
from ..schemas.download import (
    DownloadRequest,
    DownloadResponse,
    VideoInfo,
    VideoFormat,
    Format,
    Quality,
)

logger = logging.getLogger(__name__)
settings = get_settings()


class DownloaderService:
    def __init__(self):
        self._download_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_DOWNLOADS)
        self._active_downloads: Dict[str, Any] = {}

    def _get_format_options(self, format: Format, quality: Quality, url: str) -> dict:
        base_opts = {
            "quiet": True,
            "no_warnings": True,
        }

        # Add Instagram-specific options if it's an Instagram URL
        if "instagram.com" in url.lower():
            base_opts.update({
                "cookiesfrombrowser": ("chrome",),
                "add_header": [
                    ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"),
                    ("Accept", "*/*"),
                    ("Accept-Encoding", "gzip, deflate, br"),
                    ("Accept-Language", "en-US,en;q=0.9"),
                    ("Origin", "https://www.instagram.com"),
                    ("Referer", "https://www.instagram.com/"),
                ]
            })

        if format == Format.AUDIO:
            base_opts.update({
                "format": "bestaudio/best",
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                }]
            })
            return base_opts

        # Video format selection
        quality_map = {
            Quality.HD1080: "1080",
            Quality.HD720: "720",
            Quality.SD480: "480",
            Quality.SD360: "360",
        }

        if quality == Quality.HIGHEST:
            format_str = "bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        else:
            height = quality_map.get(quality, "720")
            format_str = f"bestvideo[height<=?{height}][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<=?{height}][ext=mp4]/best"

        base_opts.update({
            "format": format_str,
            "merge_output_format": "mp4"
        })
        return base_opts

    async def get_video_info(self, url: str) -> VideoInfo:
        try:
            # Base options
            ydl_opts = {
                "quiet": True,
                "no_warnings": True,
                "extract_flat": False,
            }

            # Add Instagram-specific options if it's an Instagram URL
            if "instagram.com" in url.lower():
                ydl_opts.update({
                    "cookiesfrombrowser": ("chrome",),  # Use Chrome cookies
                    "add_header": [
                        ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"),
                        ("Accept", "*/*"),
                        ("Accept-Encoding", "gzip, deflate, br"),
                        ("Accept-Language", "en-US,en;q=0.9"),
                        ("Origin", "https://www.instagram.com"),
                        ("Referer", "https://www.instagram.com/"),
                    ]
                })

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = await asyncio.to_thread(ydl.extract_info, url, download=False)

                formats = []
                for f in info.get("formats", []):
                    if f.get("vcodec") != "none" or f.get("acodec") != "none":
                        format_type = "video" if f.get("vcodec") != "none" else "audio"
                        formats.append(
                            VideoFormat(
                                quality=f.get("height"),
                                format=format_type,
                                size=f.get("filesize") or f.get("filesize_approx"),
                            )
                        )

                # Remove duplicates and sort by quality
                unique_formats = {}
                for f in formats:
                    quality_key = f.quality
                    if quality_key not in unique_formats:
                        unique_formats[quality_key] = f

                return VideoInfo(
                    title=info.get("title", ""),
                    thumbnail=info.get("thumbnail"),
                    duration=info.get("duration"),
                    formats=list(unique_formats.values()),
                )
        except Exception as e:
            logger.error(f"Error extracting video info: {str(e)}")
            raise

    async def start_download(self, request: DownloadRequest) -> DownloadResponse:
        async with self._download_semaphore:
            try:
                # Get basic info first
                info = await self.get_video_info(str(request.url))

                # Prepare options with URL-specific settings
                ydl_opts = {
                    "paths": {"home": settings.DOWNLOAD_DIR},
                    "outtmpl": "%(title)s.%(ext)s",
                    **self._get_format_options(request.format, request.quality, str(request.url))
                }

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    video_info = await asyncio.to_thread(ydl.extract_info, str(request.url))
                    filename = ydl.prepare_filename(video_info)

                    return DownloadResponse(
                        url=video_info.get("url", ""),
                        filename=Path(filename).name,
                        title=video_info.get("title", ""),
                        thumbnail=video_info.get("thumbnail"),
                        content_type="audio/mp3" if request.format == Format.AUDIO else "video/mp4",
                        size=video_info.get("filesize_approx"),
                    )

            except Exception as e:
                logger.error(f"Download error: {str(e)}")
                raise


# Create a singleton instance
downloader = DownloaderService()
