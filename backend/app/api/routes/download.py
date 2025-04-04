from fastapi import APIRouter, HTTPException, BackgroundTasks, Header, Request
from fastapi.responses import StreamingResponse
from typing import Optional
from ...services.download import DownloadService
from pydantic import BaseModel
import logging
from enum import Enum
import traceback
from urllib.parse import quote

logger = logging.getLogger(__name__)

router = APIRouter()
download_service = DownloadService()


class Format(str, Enum):
    VIDEO = "video"
    AUDIO = "audio"


class Quality(str, Enum):
    HIGHEST = "highest"
    HD1080 = "1080p"
    HD720 = "720p"
    SD480 = "480p"
    SD360 = "360p"


class Platform(str, Enum):
    YOUTUBE = "youtube"
    FACEBOOK = "facebook"
    TWITTER = "twitter"
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    REDDIT = "reddit"


class DownloadRequest(BaseModel):
    url: str
    platform: Platform
    format: Format
    quality: Quality


def get_format_string(format: Format, quality: Quality) -> Optional[str]:
    if format == Format.AUDIO:
        return "bestaudio[ext=mp4]/bestaudio[ext=mp4]/bestaudio"

    quality_map = {
        Quality.HIGHEST: "bestvideo[ext=mp4]+bestaudio[ext=mp4]/best[ext=mp4]/best",
        Quality.HD1080: "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=mp4]/best[height<=1080][ext=mp4]/best",
        Quality.HD720: "bestvideo[height<=720][ext=mp4]+bestaudio[ext=mp4]/best[height<=720][ext=mp4]/best",
        Quality.SD480: "bestvideo[height<=480][ext=mp4]+bestaudio[ext=mp4]/best[height<=480][ext=mp4]/best",
        Quality.SD360: "bestvideo[height<=360][ext=mp4]+bestaudio[ext=mp4]/best[height<=360][ext=mp4]/best",
    }
    return quality_map.get(quality)


@router.post("/info")
async def get_video_info(
    request: DownloadRequest,
    req: Request,
    cookie: Optional[str] = Header(None)
):
    try:
        logger.info(f"Received info request for URL: {request.url}")
        logger.info(f"Request headers: {dict(req.headers)}")
        logger.info(f"Platform: {request.platform}, Format: {request.format}, Quality: {request.quality}")
        
        info = await download_service.get_video_info(
            request.url,
            platform=request.platform,
            cookies=cookie
        )
        logger.info(f"Successfully retrieved info for URL: {request.url}")
        return info
    except Exception as e:
        logger.error(f"Error getting video info: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Special handling for yt-dlp extraction errors
        error_message = str(e)
        if "Failed to extract any player response" in error_message:
            error_message = "YouTube extraction failed. This is usually caused by YouTube updates that require yt-dlp to be updated. Please try a different video or wait for a backend update."
        
        raise HTTPException(
            status_code=400,
            detail={
                "error": error_message,
                "traceback": traceback.format_exc() if not str(e).startswith("HTTP Error") else None
            }
        )


@router.post("/start")
async def start_download(
    request: DownloadRequest,
    background_tasks: BackgroundTasks,
    req: Request,
    cookie: Optional[str] = Header(None)
):
    try:
        logger.info(f"Starting download for URL: {request.url}")
        logger.info(f"Request headers: {dict(req.headers)}")
        logger.info(f"Platform: {request.platform}, Format: {request.format}, Quality: {request.quality}")
        
        format_string = get_format_string(request.format, request.quality)
        if not format_string:
            raise HTTPException(status_code=400, detail="Invalid format or quality combination")
        
        logger.info(f"Using format string: {format_string}")
        result = await download_service.download_video(
            request.url,
            format_string,
            platform=request.platform,
            cookies=cookie
        )
        logger.info(f"Download completed: {result['filename']}")
        
        async def cleanup_file():
            try:
                import os
                os.unlink(result["file_path"])
                logger.info(f"Cleaned up file: {result['file_path']}")
            except Exception as e:
                logger.error(f"Error cleaning up file: {str(e)}")
                logger.error(f"Traceback: {traceback.format_exc()}")
        
        def iterfile():
            try:
                with open(result["file_path"], "rb") as f:
                    while chunk := f.read(8192):
                        yield chunk
            except Exception as e:
                logger.error(f"Error streaming file: {str(e)}")
                logger.error(f"Traceback: {traceback.format_exc()}")
                raise
        
        background_tasks.add_task(cleanup_file)

        # Always use mp4 content type
        content_type = "video/mp4"

        headers = {
            "Content-Disposition": f'attachment; filename="{result["filename"]}"',
            "Content-Type": content_type,
            "Access-Control-Expose-Headers": "Content-Disposition, Content-Type"
        }
        
        logger.info(f"Streaming response with headers: {headers}")
        return StreamingResponse(
            iterfile(),
            headers=headers,
            media_type=content_type
        )
        
    except Exception as e:
        logger.error(f"Error starting download: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Special handling for yt-dlp extraction errors
        error_message = str(e)
        if "Failed to extract any player response" in error_message:
            error_message = "YouTube extraction failed. This is usually caused by YouTube updates that require yt-dlp to be updated. Please try a different video or wait for a backend update."
        
        raise HTTPException(
            status_code=400,
            detail={
                "error": error_message,
                "traceback": traceback.format_exc() if not str(e).startswith("HTTP Error") else None
            }
        )
