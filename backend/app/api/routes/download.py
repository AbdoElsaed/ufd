from fastapi import APIRouter, HTTPException, Depends
from ...schemas.download import (
    DownloadRequest,
    DownloadResponse,
    VideoInfo,
    ErrorResponse,
    Platform,
)
from ...services.downloader import downloader
from ...core.config import get_settings
import logging
import yt_dlp
import asyncio
import re
from fastapi.responses import StreamingResponse
import subprocess
import sys
from typing import AsyncGenerator
from pathlib import Path
import time
import aiofiles
import os

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


# Helper function to sanitize filenames
def sanitize_filename(filename: str) -> str:
    # Replace problematic characters with underscore
    sanitized = re.sub(r'[<>:"/\\|?*\u0000-\u001F\u007F-\u009F]', "_", filename)
    # Ensure ASCII compatibility
    sanitized = sanitized.encode("ascii", "ignore").decode()
    return sanitized if sanitized else "download"


@router.post(
    "/info",
    response_model=VideoInfo,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    description="Get video information without downloading",
)
async def get_video_info(request: DownloadRequest):
    try:
        logger.info(
            f"Getting video info for URL: {request.url} (Platform: {request.platform})"
        )
        return await downloader.get_video_info(str(request.url), request.platform)
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        logger.error(f"yt-dlp download error: {error_msg}")

        # YouTube specific errors
        if "This content isn't available" in error_msg:
            if "age-restricted" in error_msg.lower():
                raise HTTPException(
                    status_code=403,
                    detail="This video is age-restricted. Please ensure you are logged into YouTube in Chrome.",
                )
            elif "private video" in error_msg.lower():
                raise HTTPException(
                    status_code=403,
                    detail="This video is private and cannot be accessed.",
                )
            elif "in your country" in error_msg.lower():
                raise HTTPException(
                    status_code=451,
                    detail="This video is not available in your region. Try using a VPN.",
                )
            elif "members-only" in error_msg.lower():
                raise HTTPException(
                    status_code=403,
                    detail="This video is only available to channel members.",
                )
            elif "has been removed" in error_msg.lower():
                raise HTTPException(
                    status_code=410, detail="This video has been removed or deleted."
                )
            else:
                raise HTTPException(
                    status_code=404,
                    detail="Video not found or is not publicly available. If this is a YouTube video, try logging into YouTube in Chrome.",
                )
        elif "Account authentication" in error_msg:
            platform_name = request.platform.value.capitalize()
            raise HTTPException(
                status_code=401,
                detail=f"Authentication required. Please ensure you are logged into {platform_name} in Chrome browser.",
            )
        else:
            raise HTTPException(
                status_code=500, detail=f"Failed to get video information: {error_msg}"
            )
    except Exception as e:
        logger.error(f"Error getting video info: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get video information: {str(e)}"
        )


@router.post(
    "/start",
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    description="Stream download directly to client",
)
async def start_download(request: DownloadRequest):
    try:
        # Get video info first for the title
        info = await downloader.get_video_info(str(request.url), request.platform)

        # Prepare format string
        if request.format == "audio":
            format_string = "bestaudio[ext=m4a]/bestaudio"
            content_type = "audio/mp4"
            ext = "m4a"
        else:
            if request.quality == "highest":
                format_string = "bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/best[ext=mp4]/best"
            else:
                height = request.quality.replace("p", "")
                format_string = f"bestvideo[height<={height}][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<={height}][ext=mp4]/best"
            content_type = "video/mp4"
            ext = "mp4"

        # Generate safe filename
        safe_title = sanitize_filename(info.title)
        filename = f"{safe_title}.{ext}"

        logger.info(f"Starting download: {filename} with format: {format_string}")

        async def stream_download():
            cmd = [
                "yt-dlp",
                "-f", format_string,
                "--merge-output-format", "mp4",
                "--format-sort", "ext:mp4:m4a",
                "--format-sort-force",
            ]

            # Only use Chrome cookies in development
            if not os.getenv("RENDER", "false").lower() == "true":
                cmd.extend(["--cookies-from-browser", "chrome"])

            # Add platform-specific options
            if request.platform == Platform.YOUTUBE:
                if os.getenv("RENDER", "false").lower() == "true":
                    # Production YouTube options
                    cmd.extend([
                        "--extractor-args", "youtube:player_client=android,web,mobile",
                        "--no-check-certificate",
                        "--force-ipv4",
                    ])
                else:
                    # Development YouTube options
                    cmd.extend([
                        "--extractor-args", "youtube:player_client=android",
                        "--extractor-args", "youtube:player_skip=webpage,configs",
                    ])

            # Add common headers
            cmd.extend([
                "--add-header", f"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                "--add-header", "Accept: */*",
                "--add-header", "Accept-Encoding: gzip, deflate, br",
                "--add-header", "Accept-Language: en-US,en;q=0.9",
            ])

            # Add platform-specific headers
            platform_origins = {
                Platform.YOUTUBE: "https://www.youtube.com",
                Platform.INSTAGRAM: "https://www.instagram.com",
                Platform.REDDIT: "https://www.reddit.com",
                Platform.FACEBOOK: "https://www.facebook.com",
                Platform.TWITTER: "https://twitter.com",
                Platform.TIKTOK: "https://www.tiktok.com",
            }

            if request.platform in platform_origins:
                origin = platform_origins[request.platform]
                cmd.extend([
                    "--add-header", f"Origin: {origin}",
                    "--add-header", f"Referer: {origin}/",
                ])

            # Stream directly to stdout
            cmd.extend([
                "-o", "-",  # Output to stdout
                "--no-playlist",
                "--no-warnings",
                "--no-check-certificate",
                str(request.url)
            ])

            try:
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )

                while True:
                    chunk = await process.stdout.read(8192)
                    if not chunk:
                        break
                    yield chunk

                # Check for errors after streaming is complete
                stderr = await process.stderr.read()
                await process.wait()

                if process.returncode != 0:
                    error_msg = stderr.decode() if stderr else "Unknown error during download"
                    logger.error(f"yt-dlp error: {error_msg}")
                    raise HTTPException(status_code=500, detail=f"Download failed: {error_msg}")

            except Exception as e:
                logger.error(f"Streaming error: {str(e)}")
                if process:
                    try:
                        process.kill()
                    except:
                        pass
                raise

        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": content_type,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }

        logger.info(f"Starting stream with headers: {headers}")

        return StreamingResponse(
            stream_download(), headers=headers, media_type=content_type
        )

    except Exception as e:
        logger.error(f"Error starting download: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to start download: {str(e)}"
        )
