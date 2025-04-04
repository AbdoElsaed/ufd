from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from pathlib import Path

class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "UFD Backend"
    
    # CORS Settings - Include extension URLs
    CORS_ORIGINS: str = "https://ufd-kappa.vercel.app,http://localhost:3000,moz-extension://*,chrome-extension://*"
    
    # File Storage Settings
    DOWNLOAD_DIR: str = "downloads"
    TEMP_DIR: str = "temp"
    
    # Download Settings
    MAX_CONCURRENT_DOWNLOADS: int = 2
    YDL_SLEEP_INTERVAL: int = 2
    YDL_MAX_SLEEP_INTERVAL: int = 5
    YDL_SLEEP_INTERVAL_REQUESTS: int = 3
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache()
def get_settings() -> Settings:
    return Settings()

# Create necessary directories
settings = get_settings()
os.makedirs(settings.DOWNLOAD_DIR, exist_ok=True)
os.makedirs(settings.TEMP_DIR, exist_ok=True) 