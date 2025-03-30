from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from pathlib import Path

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "UFD Backend"
    CORS_ORIGINS: list[str] = ["https://ufd-kappa.vercel.app", "http://localhost:3000"]
    DOWNLOAD_DIR: str = "downloads"
    MAX_CONCURRENT_DOWNLOADS: int = 5
    TEMP_DIR: str = "temp"
    
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