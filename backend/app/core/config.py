from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from pathlib import Path
from typing import List


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "UFD Backend"
    CORS_ORIGINS: str = "https://ufd-kappa.vercel.app,http://localhost:3000"
    DOWNLOAD_DIR: str = "downloads"
    MAX_CONCURRENT_DOWNLOADS: int = 5
    TEMP_DIR: str = "temp"

    @property
    def cors_origins_list(self) -> List[str]:
        return [
            origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()
        ]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Create download and temp directories if they don't exist
settings = get_settings()
os.makedirs(settings.DOWNLOAD_DIR, exist_ok=True)
os.makedirs(settings.TEMP_DIR, exist_ok=True)
