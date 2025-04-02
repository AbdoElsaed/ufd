import yt_dlp
import asyncio
from typing import Dict, Any, Optional
import logging
from pathlib import Path
import json
import os
from datetime import datetime

logger = logging.getLogger(__name__)


class DownloadService:
    def __init__(self, temp_dir: str = "temp", download_dir: str = "downloads"):
        self.temp_dir = Path(temp_dir)
        self.download_dir = Path(download_dir)
        self.temp_dir.mkdir(exist_ok=True)
        self.download_dir.mkdir(exist_ok=True)

        # Semaphore for concurrent downloads
        self.semaphore = asyncio.Semaphore(2)

    def _get_yt_dlp_opts(self, format_id: str = None) -> Dict[str, Any]:
        """Get yt-dlp options based on format."""
        opts = {
            "format": format_id
            or "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
            "youtube_include_dash_manifest": False,
            "youtube_include_hls_manifest": False,
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "web"],
                    "player_skip": ["webpage", "config"],
                }
            },
            "sleep_interval": 2,
            "max_sleep_interval": 5,
            "sleep_interval_requests": 3,
        }
        return opts

    async def get_video_info(self, url: str) -> Dict[str, Any]:
        """Get video information."""
        try:
            with yt_dlp.YoutubeDL(self._get_yt_dlp_opts()) as ydl:
                info = await asyncio.to_thread(ydl.extract_info, url, download=False)

                formats = []
                if "formats" in info:
                    for f in info["formats"]:
                        if f.get("vcodec", "none") != "none":  # Video format
                            formats.append(
                                {
                                    "quality": f'{f.get("height", "?")}p',
                                    "format": "video",
                                    "size": f.get("filesize_approx", 0),
                                }
                            )

                return {
                    "title": info.get("title", "Unknown Title"),
                    "thumbnail": info.get("thumbnail"),
                    "duration": info.get("duration"),
                    "formats": formats,
                }

        except Exception as e:
            logger.error(f"Error getting video info: {str(e)}")
            raise

    async def download_video(
        self, url: str, format_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Download video with the specified format."""
        async with self.semaphore:
            try:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                temp_file = self.temp_dir / f"download_{timestamp}.mp4"

                opts = self._get_yt_dlp_opts(format_id)
                opts.update(
                    {
                        "outtmpl": str(temp_file),
                        "quiet": False,
                        "progress": True,
                    }
                )

                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = await asyncio.to_thread(ydl.extract_info, url)
                    filename = ydl.prepare_filename(info)

                    return {
                        "file_path": str(temp_file),
                        "filename": Path(filename).name,
                        "title": info.get("title", "Unknown Title"),
                        "content_type": "video/mp4",
                    }

            except Exception as e:
                logger.error(f"Error downloading video: {str(e)}")
                if temp_file.exists():
                    temp_file.unlink()
                raise
