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
    'youtube': ['.youtube.com', '.google.com', 'accounts.google.com', 'www.youtube.com', 'youtube.com'],
    'facebook': ['.facebook.com', '.fb.com', 'www.facebook.com', 'facebook.com', 'm.facebook.com'],
    'twitter': ['.twitter.com', '.x.com', 'twitter.com', 'www.twitter.com', 'x.com'],
    'instagram': ['.instagram.com', '.cdninstagram.com', 'www.instagram.com', 'instagram.com'],
    'tiktok': ['.tiktok.com', '.tiktokcdn.com', 'www.tiktok.com', 'tiktok.com'],
    'reddit': ['.reddit.com', '.redd.it', 'www.reddit.com', 'reddit.com', 'old.reddit.com']
}

class DownloadService:
    def __init__(self, temp_dir: str = "temp", download_dir: str = "downloads"):
        self.temp_dir = Path(temp_dir)
        self.download_dir = Path(download_dir)
        self.temp_dir.mkdir(exist_ok=True)
        self.download_dir.mkdir(exist_ok=True)
        self.semaphore = asyncio.Semaphore(2)

    def _process_auth_info(self, auth_info: Optional[Dict[str, Any]], platform: str = None) -> Dict[str, Any]:
        """Process authentication information from the browser extension."""
        if not auth_info:
            return {}
        
        result = {}
        
        # Log the auth info we received (without exposing sensitive values)
        logger.info(f"Processing auth info for platform: {platform}")
        logger.info(f"Auth info keys: {list(auth_info.keys())}")
        
        # Extract authentication status
        if 'isLoggedIn' in auth_info:
            result['is_authenticated'] = auth_info['isLoggedIn']
            logger.info(f"User is authenticated: {result['is_authenticated']}")
        
        # Extract additional platform-specific information
        if platform == 'youtube':
            if 'isAgeRestricted' in auth_info:
                result['is_age_restricted'] = auth_info['isAgeRestricted']
                logger.info(f"Content is age restricted: {result['is_age_restricted']}")
            
            if 'videoElement' in auth_info:
                result['has_video_element'] = auth_info['videoElement']
                logger.info(f"Page has video element: {result['has_video_element']}")
        
        # Extract page title if available
        if 'title' in auth_info:
            result['page_title'] = auth_info['title']
            logger.info(f"Page title: {result['page_title']}")
        
        # Extract cookies if they're provided directly in the auth_info
        if 'cookies' in auth_info and auth_info['cookies']:
            result['cookies'] = auth_info['cookies']
            logger.info(f"Received {len(auth_info['cookies'].split(';'))} cookies in auth_info")
        
        # Extract user agent if provided
        if 'userAgent' in auth_info:
            result['user_agent'] = auth_info['userAgent']
            logger.info(f"Using custom user agent from auth_info")
        
        return result

    def _create_cookies_file(self, cookies: str, platform: str = None, auth_info: Optional[Dict[str, Any]] = None) -> str:
        """Create a temporary cookies.txt file from browser cookies."""
        # Process any cookies from auth_info
        processed_auth = self._process_auth_info(auth_info, platform)
        if 'cookies' in processed_auth and not cookies:
            cookies = processed_auth['cookies']
            logger.info(f"Using cookies from auth_info instead of header cookies")
        
        if not cookies:
            logger.warning("No cookies provided to create cookie file")
            return None

        try:
            # Create a temporary file for cookies
            fd, path = tempfile.mkstemp(suffix='.txt', dir=self.temp_dir)
            
            # Get platform domains
            domains = PLATFORM_DOMAINS.get(platform, []) if platform else [None]
            if not domains:
                logger.warning(f"No domain configured for platform {platform}, using default domains")
                domains = ['.youtube.com', '.google.com']  # Default to YouTube domains as fallback
            
            logger.info(f"Creating cookies file for domains: {domains}")
            
            # Convert cookies string to Netscape format
            cookie_lines = []
            cookie_count = 0
            
            # Special handling for YouTube cookies
            if platform == 'youtube':
                # Add standard Netscape cookie file header
                cookie_lines.append("# Netscape HTTP Cookie File")
                cookie_lines.append("# This file was generated by UFD Backend")
                cookie_lines.append("")
            
            # Process each cookie
            for cookie in cookies.split(';'):
                cookie = cookie.strip()
                if '=' in cookie:
                    try:
                        name, value = cookie.split('=', 1)
                        name = name.strip()
                        value = value.strip()
                        
                        if not name or not value:
                            continue
                            
                        # Add cookie for each domain
                        for domain in domains:
                            if domain:
                                # Format: domain, domain_initial_dot, path, secure, expiry, name, value
                                expiry = int(datetime.now().timestamp()) + 31536000  # 1 year from now
                                
                                # Special handling for critical cookies
                                if platform == 'youtube' and name in ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', 
                                                                      '__Secure-1PSID', '__Secure-3PSID']:
                                    # These are critical auth cookies, ensure they're correctly formatted
                                    logger.info(f"Adding critical auth cookie: {name}")
                                    is_secure = 'TRUE' if name.startswith('__Secure') else 'FALSE'
                                    
                                    cookie_lines.append(f"{domain}\tTRUE\t/\t{is_secure}\t{expiry}\t{name}\t{value}")
                                    cookie_count += 1
                                else:
                                    # Standard cookie
                                    cookie_lines.append(f"{domain}\tTRUE\t/\tFALSE\t{expiry}\t{name}\t{value}")
                                    cookie_count += 1
                    except Exception as e:
                        logger.warning(f"Error processing cookie {cookie}: {e}")
                        continue
            
            # Write cookies to file
            with os.fdopen(fd, 'w') as f:
                f.write('\n'.join(cookie_lines))
            
            # Verify the file was written correctly
            if os.path.exists(path) and os.path.getsize(path) > 0:
                logger.info(f"Created cookies file at {path} with {cookie_count} cookies for platform: {platform}")
                
                # Log the first few lines for debugging (without showing values)
                try:
                    with open(path, 'r') as f:
                        first_lines = [line.split('\t')[0:6] + ['[VALUE_HIDDEN]'] if '\t' in line else line for line in f.readlines()[:5]]
                        logger.info(f"Cookie file preview (first 5 lines): {first_lines}")
                except Exception as e:
                    logger.warning(f"Could not read cookie file for preview: {e}")
                
                return path
            else:
                logger.error(f"Cookie file was not created properly at {path}")
                return None
                
        except Exception as e:
            logger.error(f"Error creating cookies file: {e}")
            return None

    def _get_yt_dlp_opts(self, format_id: str = None, cookies: str = None, platform: str = None, auth_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Get yt-dlp options based on format and cookies."""
        # Process auth info from extension
        processed_auth = self._process_auth_info(auth_info, platform)
        
        # Get user agent - either from auth_info or random mobile user agent
        user_agent = processed_auth.get('user_agent', random.choice(MOBILE_USER_AGENTS))
        
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
            'DNT': '1',
            'Connection': 'keep-alive',
        }

        # Add platform-specific referer and origin
        if platform:
            referers = {
                'youtube': 'https://www.youtube.com/',
                'facebook': 'https://www.facebook.com/',
                'twitter': 'https://twitter.com/',
                'instagram': 'https://www.instagram.com/',
                'tiktok': 'https://www.tiktok.com/',
                'reddit': 'https://www.reddit.com/'
            }
            origins = {
                'youtube': 'https://www.youtube.com',
                'facebook': 'https://www.facebook.com',
                'twitter': 'https://twitter.com',
                'instagram': 'https://www.instagram.com',
                'tiktok': 'https://www.tiktok.com',
                'reddit': 'https://www.reddit.com'
            }
            headers['Referer'] = referers.get(platform, '')
            headers['Origin'] = origins.get(platform, '')

        if cookies:
            headers['Cookie'] = cookies
            logger.info(f"Added cookie header with {len(cookies.split(';'))} cookies")

        # Check if we're running in Docker/Render
        is_docker = os.environ.get('RENDER') == 'true'
        logger.info(f"Running in Docker/Render environment: {is_docker}")
        
        # Base options with better retry and timeout settings
        opts = {
            "format": format_id or "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
            "http_headers": headers,
            "nocheckcertificate": True,
            "youtube_include_dash_manifest": False,
            "youtube_include_hls_manifest": False,
            "retries": 10,               # Increase retries
            "fragment_retries": 10,      # Increase fragment retries
            "skip_unavailable_fragments": True,
            "extractor_retries": 5,     # Retry extractor failures
            "file_access_retries": 5,   # Retry file access
            "socket_timeout": 30,       # Longer timeout
            "external_downloader_args": {
                'ffmpeg': ['-nostats', '-loglevel', '0']
            },
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "web"],
                    "player_skip": [],  # Don't skip any steps to ensure extraction works
                    "continuation": ["default"],
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
        
        # Enhanced options for Docker/Render environments where headless browser access is available
        if is_docker and platform == 'youtube':
            logger.info("Adding browser-specific options for YouTube extraction")
            opts.update({
                "verbose": True,  # Enable verbose output for better debugging
                "debug_printtraffic": True,  # Print traffic for debugging
                "force_generic_extractor": False,
                "downloader": "websocket_fragment",
            })
            
            # Use Chromium if available in Docker
            if os.path.exists("/usr/bin/chromium"):
                logger.info("Using Chromium browser for extraction")
                opts["prefer_insecure"] = True
                opts["allow_unplayable_formats"] = True
                
                # Add experimental browser-based extraction
                if not "youtube_include_dash_manifest" in opts:
                    opts["youtube_include_dash_manifest"] = True
        
        # Log the most important options
        important_opts = {k: v for k, v in opts.items() if k in ["format", "retries", "verbose", "nocheckcertificate"]}
        logger.info(f"Important yt-dlp options: {important_opts}")

        # Create cookies file from browser cookies if provided
        if cookies:
            cookies_file = self._create_cookies_file(cookies, platform, auth_info)
            if cookies_file:
                opts["cookiefile"] = cookies_file
                logger.info(f"Using cookies file: {cookies_file}")
            else:
                logger.warning("Failed to create cookies file, will only use header cookies")

        return opts

    async def get_video_info(self, url: str, platform: str = None, cookies: str = None, auth_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Get video information."""
        try:
            logger.info(f"Getting video info for {platform} URL: {url[:30]}...")
            
            # Process authentication info from the extension
            processed_auth = self._process_auth_info(auth_info, platform)
            logger.info(f"Processed auth info: {json.dumps({k: '...' for k in processed_auth.keys()})}")
            
            # Try to parse URL to check if it's valid
            try:
                from urllib.parse import urlparse
                parsed_url = urlparse(url)
                if not parsed_url.scheme or not parsed_url.netloc:
                    raise ValueError(f"Invalid URL format: {url}")
                logger.info(f"URL validated: {parsed_url.netloc}")
            except Exception as e:
                logger.warning(f"URL validation issue: {e}")
            
            yt_dlp_opts = self._get_yt_dlp_opts(cookies=cookies, platform=platform, auth_info=auth_info)
            
            try:
                with yt_dlp.YoutubeDL(yt_dlp_opts) as ydl:
                    logger.info(f"Calling yt-dlp extract_info for {platform}")
                    info = await asyncio.to_thread(ydl.extract_info, url, download=False)
                    logger.info(f"Successfully extracted info for {platform} URL")
                    
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
                    
                    logger.info(f"Found {len(formats)} available formats")
                    return {
                        "title": info.get("title", "Unknown Title"),
                        "thumbnail": info.get("thumbnail"),
                        "duration": info.get("duration"),
                        "formats": formats,
                    }
            except yt_dlp.utils.DownloadError as e:
                error_message = str(e)
                logger.error(f"yt-dlp download error: {error_message}")
                
                # Better error messages for user
                if "Failed to extract any player response" in error_message:
                    error_message = ("YouTube extraction failed. This is usually caused by YouTube updates that require yt-dlp to be updated. "
                                    "Please try a different video or wait for the backend to be updated. "
                                    "Error details: Failed to extract player response")
                elif "Sign in to confirm you're not a bot" in error_message:
                    auth_status = "authenticated" if processed_auth.get('is_authenticated', False) else "not authenticated"
                    error_message = f"YouTube requires you to sign in to access this video. Please sign in to your YouTube account in the browser. (Current status: {auth_status})"
                elif "Private video" in error_message:
                    error_message = "This is a private video. You need to be logged in with an account that has access to this video."
                elif "This video is not available" in error_message:
                    error_message = "This video is not available. It may have been removed by the uploader or taken down for policy violations."
                
                # Include relevant info about the environment
                is_docker = os.environ.get('RENDER') == 'true'
                error_context = f" (Platform: {platform}, Docker/Render: {is_docker})"
                raise Exception(error_message + error_context)
            
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
        self, url: str, format_id: Optional[str] = None, platform: str = None, cookies: str = None, auth_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Download video with the specified format."""
        async with self.semaphore:
            try:
                logger.info(f"Starting download for {platform} URL: {url[:30]}...")
                
                # Process authentication info from the extension
                processed_auth = self._process_auth_info(auth_info, platform)
                logger.info(f"Processed auth info for download: {json.dumps({k: '...' for k in processed_auth.keys()})}")
                
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                temp_file = self.temp_dir / f"download_{timestamp}.mp4"

                # Create options for yt-dlp
                opts = self._get_yt_dlp_opts(format_id, cookies=cookies, platform=platform, auth_info=auth_info)
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

                try:
                    # Try with the configured options
                    logger.info(f"Attempting download with primary configuration for {platform}")
                    with yt_dlp.YoutubeDL(opts) as ydl:
                        info = await asyncio.to_thread(ydl.extract_info, url)
                        logger.info(f"Download completed successfully with primary configuration")
                except yt_dlp.utils.DownloadError as e:
                    error_message = str(e)
                    logger.error(f"Primary download attempt failed: {error_message}")
                    
                    # If we get a specific YouTube extraction error and we're on Docker/Render, try alternate method
                    if "Failed to extract any player response" in error_message and os.environ.get('RENDER') == 'true':
                        logger.info("Attempting fallback method for YouTube extraction")
                        
                        # Try with simplified options focused on reliability
                        fallback_opts = {
                            "format": "best[ext=mp4]/best",
                            "quiet": False,
                            "verbose": True,
                            "no_warnings": False,
                            "outtmpl": str(temp_file),
                            "retries": 15,
                            "fragment_retries": 15,
                            "skip_unavailable_fragments": True,
                            "http_headers": opts["http_headers"],
                            "nocheckcertificate": True,
                            "prefer_insecure": True,
                            "sleep_interval": 5,
                            "max_sleep_interval": 10,
                            "sleep_interval_requests": 2,
                        }
                        
                        # If we have a cookies file, use it
                        if "cookiefile" in opts and os.path.exists(opts["cookiefile"]):
                            fallback_opts["cookiefile"] = opts["cookiefile"]
                        
                        with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                            logger.info("Executing fallback download method...")
                            info = await asyncio.to_thread(ydl.extract_info, url)
                            logger.info("Fallback download method succeeded!")
                    else:
                        # If it's not a YouTube extraction error or fallback is not applicable, re-raise
                        # Create a more user-friendly error message
                        if "Failed to extract any player response" in error_message:
                            error_message = ("YouTube extraction failed. This is usually caused by YouTube updates that require yt-dlp to be updated. "
                                            "Please try a different video or wait for the backend to be updated.")
                        elif "Sign in to confirm you're not a bot" in error_message:
                            auth_status = "authenticated" if processed_auth.get('is_authenticated', False) else "not authenticated"
                            error_message = f"YouTube requires you to sign in to access this video. Please sign in to your YouTube account in the browser. (Current status: {auth_status})"
                        
                        # Include relevant info about the environment
                        is_docker = os.environ.get('RENDER') == 'true'
                        error_context = f" (Platform: {platform}, Docker/Render: {is_docker})"
                        raise Exception(error_message + error_context)
                
                # At this point, we have successfully downloaded the video
                # Always use mp4 extension
                filename = f"download_{timestamp}.mp4"
                
                # Verify the file exists and has content
                if not temp_file.exists():
                    raise Exception(f"Download completed but file was not created at {temp_file}")
                
                if temp_file.stat().st_size == 0:
                    raise Exception(f"Download completed but file is empty at {temp_file}")
                
                logger.info(f"Download successful! File size: {temp_file.stat().st_size} bytes")

                return {
                    "file_path": str(temp_file),
                    "filename": filename,
                    "title": info.get("title", "Unknown Title"),
                    "content_type": "video/mp4",
                }

            except Exception as e:
                logger.error(f"Error downloading video: {str(e)}")
                if temp_file.exists():
                    try:
                        temp_file.unlink()
                        logger.info(f"Cleaned up incomplete download file: {temp_file}")
                    except Exception as clean_err:
                        logger.warning(f"Failed to clean up file {temp_file}: {clean_err}")
                raise
            finally:
                # Cleanup any temporary cookie files
                for file in self.temp_dir.glob("*.txt"):
                    try:
                        file.unlink()
                    except Exception as e:
                        logger.warning(f"Failed to delete temporary file {file}: {e}")
