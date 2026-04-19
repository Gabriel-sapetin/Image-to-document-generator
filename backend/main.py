"""
Main application entry point
"""
import logging
import asyncio
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

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title=settings.APP_NAME,
    description="Convert images to PDF and Word documents",
    version="1.0.0"
)

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
            'DELETE /api/session/{id}': 'Delete session',
            'GET /api/health': 'Health check'
        }
    }


async def _cleanup_loop():
    """Background task: clean expired sessions every 5 minutes."""
    while True:
        await asyncio.sleep(300)
        try:
            from app.routes.images import session_manager
            removed = session_manager.cleanup_expired()
            if removed:
                logger.info(f"Auto-cleanup: removed {removed} expired session(s)")
        except Exception as e:
            logger.error(f"Cleanup loop error: {e}")


@app.on_event("startup")
async def startup():
    logger.info(f"🚀 {settings.APP_NAME} starting...")
    logger.info(f"Rate limiting: enabled (slowapi)")
    logger.info(f"Thread pool: enabled (4 workers)")
    logger.info(f"Session storage: SQLite ({settings.SESSION_DIR})")
    asyncio.create_task(_cleanup_loop())
    logger.info("Background cleanup task started (every 5 min)")


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