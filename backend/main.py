from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api.routes import download
import logging
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

settings = get_settings()

# Log important configuration
logger.info(f"API_V1_STR: {settings.API_V1_STR}")
logger.info(f"CORS Origins: {settings.cors_origins_list}")
logger.info(f"Environment: {'production' if os.getenv('RENDER') else 'development'}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS with logging
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type"],
    max_age=3600,
)

# Debug middleware to log requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request path: {request.url.path}")
    logger.info(f"Request method: {request.method}")
    logger.info(f"Request headers: {dict(request.headers)}")
    logger.info(f"Client host: {request.client.host if request.client else 'Unknown'}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

# Include routers
app.include_router(
    download.router,
    prefix=f"{settings.API_V1_STR}/download",
    tags=["download"]
)

# Health check endpoint
@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "cors_origins": settings.cors_origins_list,
        "environment": "production" if os.getenv('RENDER') else "development"
    }
