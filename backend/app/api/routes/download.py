from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import Optional
from ...services.download import DownloadService
from pydantic import BaseModel
import logging
from enum import Enum

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
        return "bestaudio[ext=m4a]/bestaudio"

    quality_map = {
        Quality.HIGHEST: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        Quality.HD1080: "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
        Quality.HD720: "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
        Quality.SD480: "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best",
        Quality.SD360: "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best",
    }
    return quality_map.get(quality)


@router.post("/info")
async def get_video_info(request: DownloadRequest):
    try:
        logger.info(f"Getting video info for URL: {request.url}")
        info = await download_service.get_video_info(request.url)
        return info
    except Exception as e:
        logger.error(f"Error getting video info: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/start")
async def start_download(request: DownloadRequest, background_tasks: BackgroundTasks):
    try:
        logger.info(f"Starting download for URL: {request.url}")
        format_string = get_format_string(request.format, request.quality)

        if not format_string:
            raise HTTPException(
                status_code=400, detail="Invalid format or quality combination"
            )

        result = await download_service.download_video(request.url, format_string)

        async def cleanup_file():
            try:
                import os

                os.unlink(result["file_path"])
                logger.info(f"Cleaned up file: {result['file_path']}")
            except Exception as e:
                logger.error(f"Error cleaning up file: {str(e)}")

        def iterfile():
            try:
                with open(result["file_path"], "rb") as f:
                    while chunk := f.read(8192):
                        yield chunk
            except Exception as e:
                logger.error(f"Error streaming file: {str(e)}")
                raise

        background_tasks.add_task(cleanup_file)

        headers = {
            "Content-Disposition": f'attachment; filename="{result["filename"]}"',
            "Content-Type": result["content_type"],
        }

        return StreamingResponse(
            iterfile(), headers=headers, media_type=result["content_type"]
        )

    except Exception as e:
        logger.error(f"Error starting download: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
