import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.app.routes import images

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    description="Convert images to PDF and Word documents",
    version="1.0.0"
)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(images.router)

# Root endpoint
@app.get("/")
async def root():
    """API documentation"""
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
    """Startup event"""
    logger.info(f"🚀 {settings.APP_NAME} starting...")
    logger.info(f"Debug: {settings.DEBUG}")


@app.on_event("shutdown")
async def shutdown():
    """Shutdown event"""
    logger.info("🛑 Shutdown complete")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )