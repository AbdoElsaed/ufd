import yt_dlp
import asyncio
from typing import Dict, Any, Optional
import logging
from pathlib import Path
import json
import os
from datetime import datetime
import random
import tempfile
import subprocess
import sys
import pkg_resources

logger = logging.getLogger(__name__)

# Check yt-dlp version at startup
def check_ytdlp_version():
    try:
        current_version = pkg_resources.get_distribution("yt-dlp").version
        logger.info(f"Current yt-dlp version: {current_version}")
        
        # Try to get the latest version from PyPI
        try:
            import urllib.request
            import json
            
            url = "https://pypi.org/pypi/yt-dlp/json"
            with urllib.request.urlopen(url, timeout=5) as response:
                data = json.loads(response.read().decode())
                latest_version = data["info"]["version"]
                
                if current_version != latest_version:
                    logger.warning(f"yt-dlp version {current_version} is outdated! Latest is {latest_version}")
                    logger.warning("You may encounter extraction errors with YouTube. Consider updating with: python -m pip install -U yt-dlp")
                    return False
                else:
                    logger.info(f"yt-dlp is up to date (version {current_version})")
                    return True
        except Exception as e:
            logger.warning(f"Could not check for yt-dlp updates: {e}")
            return None
    except Exception as e:
        logger.error(f"Error checking yt-dlp version: {e}")
        return None

# Run the version check
is_ytdlp_updated = check_ytdlp_version()

# Mobile user agents have better success rates
MOBILE_USER_AGENTS = [
    'Mozilla/5.0 (Linux; Android 12; SM-S906N Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.119 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
    'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
]

# Platform-specific cookie domains
PLATFORM_DOMAINS = {
    'youtube': ['.youtube.com', '.google.com'],
    'facebook': ['.facebook.com', '.fb.com'],
    'twitter': ['.twitter.com', '.x.com'],
    'instagram': ['.instagram.com', '.cdninstagram.com'],
    'tiktok': ['.tiktok.com', '.tiktokcdn.com'],
    'reddit': ['.reddit.com', '.redd.it']
}

class DownloadService:
    def __init__(self, temp_dir: str = "temp", download_dir: str = "downloads"):
        self.temp_dir = Path(temp_dir)
        self.download_dir = Path(download_dir)
        self.temp_dir.mkdir(exist_ok=True)
        self.download_dir.mkdir(exist_ok=True)
        self.semaphore = asyncio.Semaphore(2)

    def _create_cookies_file(self, cookies: str, platform: str = None) -> str:
        """Create a temporary cookies.txt file from browser cookies."""
        if not cookies:
            return None

        try:
            # Create a temporary file for cookies
            fd, path = tempfile.mkstemp(suffix='.txt', dir=self.temp_dir)
            
            # Get platform domains
            domains = PLATFORM_DOMAINS.get(platform, []) if platform else [None]
            
            # Convert cookies string to Netscape format
            cookie_lines = []
            for cookie in cookies.split(';'):
                cookie = cookie.strip()
                if '=' in cookie:
                    name, value = cookie.split('=', 1)
                    # Add cookie for each domain
                    for domain in domains:
                        if domain:
                            # Format: domain, domain_initial_dot, path, secure, expiry, name, value
                            cookie_lines.append(
                                f"{domain}\tTRUE\t/\tTRUE\t{int(datetime.now().timestamp()) + 31536000}\t{name}\t{value}"
                            )
            
            # Write cookies to file
            with os.fdopen(fd, 'w') as f:
                f.write('\n'.join(cookie_lines))
            
            logger.info(f"Created cookies file at {path} with {len(cookie_lines)} cookies for platform: {platform}")
            return path
        except Exception as e:
            logger.error(f"Error creating cookies file: {e}")
            return None

    def _get_yt_dlp_opts(self, format_id: str = None, cookies: str = None, platform: str = None) -> Dict[str, Any]:
        """Get yt-dlp options based on format and cookies."""
        # Get a random mobile user agent
        user_agent = random.choice(MOBILE_USER_AGENTS)
        
        # Common headers that make requests look more legitimate
        headers = {
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
            'User-Agent': user_agent,
        }

        # Add platform-specific referer
        if platform:
            referers = {
                'youtube': 'https://www.youtube.com/',
                'facebook': 'https://www.facebook.com/',
                'twitter': 'https://twitter.com/',
                'instagram': 'https://www.instagram.com/',
                'tiktok': 'https://www.tiktok.com/',
                'reddit': 'https://www.reddit.com/'
            }
            headers['Referer'] = referers.get(platform, '')

        if cookies:
            headers['Cookie'] = cookies

        opts = {
            "format": format_id or "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
            "http_headers": headers,
            "nocheckcertificate": True,
            "youtube_include_dash_manifest": False,
            "youtube_include_hls_manifest": False,
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "web"],
                    "player_skip": ["webpage", "config", "js"],
                },
                "facebook": {"no_webpage": True},
                "twitter": {"no_webpage": True},
                "instagram": {"no_webpage": True},
                "tiktok": {"no_webpage": True},
                "reddit": {"no_webpage": True}
            },
            "sleep_interval": 2,
            "max_sleep_interval": 5,
            "sleep_interval_requests": 3,
        }

        # Create cookies file from browser cookies if provided
        if cookies:
            cookies_file = self._create_cookies_file(cookies, platform)
            if cookies_file:
                opts["cookiefile"] = cookies_file

        return opts

    async def get_video_info(self, url: str, platform: str = None, cookies: str = None) -> Dict[str, Any]:
        """Get video information."""
        try:
            with yt_dlp.YoutubeDL(self._get_yt_dlp_opts(cookies=cookies, platform=platform)) as ydl:
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
        finally:
            # Cleanup any temporary cookie files
            for file in self.temp_dir.glob("*.txt"):
                try:
                    file.unlink()
                except Exception as e:
                    logger.warning(f"Failed to delete temporary file {file}: {e}")

    async def download_video(
        self, url: str, format_id: Optional[str] = None, platform: str = None, cookies: str = None
    ) -> Dict[str, Any]:
        """Download video with the specified format."""
        async with self.semaphore:
            try:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                temp_file = self.temp_dir / f"download_{timestamp}.mp4"

                opts = self._get_yt_dlp_opts(format_id, cookies=cookies, platform=platform)
                opts.update({
                    "outtmpl": str(temp_file),
                    "quiet": False,
                    "progress": True,
                    "merge_output_format": "mp4",  # Force MP4 output
                    "postprocessors": [{
                        'key': 'FFmpegVideoConvertor',
                        'preferedformat': 'mp4',  # Ensure MP4 format
                    }]
                })

                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = await asyncio.to_thread(ydl.extract_info, url)
                    
                    # Always use mp4 extension
                    filename = f"download_{timestamp}.mp4"

                    return {
                        "file_path": str(temp_file),
                        "filename": filename,
                        "title": info.get("title", "Unknown Title"),
                        "content_type": "video/mp4",
                    }

            except Exception as e:
                logger.error(f"Error downloading video: {str(e)}")
                if temp_file.exists():
                    temp_file.unlink()
                raise
            finally:
                # Cleanup any temporary cookie files
                for file in self.temp_dir.glob("*.txt"):
                    try:
                        file.unlink()
                    except Exception as e:
                        logger.warning(f"Failed to delete temporary file {file}: {e}")
