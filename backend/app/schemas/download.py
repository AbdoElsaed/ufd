from pydantic import BaseModel, HttpUrl
from typing import Optional, Literal, Union
from enum import Enum

class Platform(str, Enum):
    YOUTUBE = "youtube"
    FACEBOOK = "facebook"
    TWITTER = "twitter"
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    REDDIT = "reddit"

class Format(str, Enum):
    VIDEO = "video"
    AUDIO = "audio"

class Quality(str, Enum):
    HIGHEST = "highest"
    HD1080 = "1080p"
    HD720 = "720p"
    SD480 = "480p"
    SD360 = "360p"

class DownloadRequest(BaseModel):
    url: HttpUrl
    platform: Platform
    format: Format
    quality: Quality

class VideoFormat(BaseModel):
    quality: Union[str, int, None]
    format: Literal["video", "audio"]
    size: Optional[Union[str, int]] = None

    def __init__(self, **data):
        super().__init__(**data)
        # Convert quality to string if it's an integer
        if isinstance(self.quality, int):
            self.quality = f"{self.quality}p"
        elif self.quality is None:
            self.quality = "audio"
        # Convert size to human readable format if it's an integer
        if isinstance(self.size, int):
            self.size = f"{self.size // (1024*1024)}MB"

class VideoInfo(BaseModel):
    title: str
    thumbnail: Optional[str] = None
    duration: Optional[float] = None
    formats: list[VideoFormat]

    def __init__(self, **data):
        # Convert duration to integer if it's a float
        if 'duration' in data and isinstance(data['duration'], float):
            data['duration'] = int(data['duration'])
        super().__init__(**data)

class DownloadResponse(BaseModel):
    url: str
    filename: str
    title: str
    thumbnail: Optional[str] = None
    content_type: str
    size: Optional[Union[int, str]] = None
    progress_url: Optional[str] = None

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None 