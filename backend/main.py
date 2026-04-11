"""
Main application entry point
"""
import logging
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from config import settings
from app.routes import images

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Rate limiter — tracks by IP address
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title=settings.APP_NAME,
    description="Convert images to PDF and Word documents",
    version="1.0.0"
)

# Attach limiter to app state so routes can use it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router with /api prefix — routes in images.py use /upload, /generate-pdf etc
app.include_router(images.router, prefix="/api")

@app.get("/")
async def root():
    return {
        'name': settings.APP_NAME,
        'version': '1.0.0',
        'endpoints': {
            'POST /api/upload': 'Upload images',
            'POST /api/generate-pdf': 'Generate PDF',
            'POST /api/generate-docx': 'Generate Word',
            'GET /api/download/{id}/{type}': 'Download',
            'GET /api/health': 'Health check'
        }
    }

@app.on_event("startup")
async def startup():
    logger.info(f"🚀 {settings.APP_NAME} starting...")
    logger.info(f"Rate limiting: enabled (slowapi)")
    logger.info(f"Thread pool: enabled (4 workers)")

@app.on_event("shutdown")
async def shutdown():
    logger.info("🛑 Shutdown complete")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )