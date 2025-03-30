from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api.routes import download
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME, openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    download.router, prefix=f"{settings.API_V1_STR}/download", tags=["download"]
)


# Move health check under API prefix
@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME, "version": "1.0.0"}
