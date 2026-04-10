"""
Application configuration
Load settings from environment variables with defaults
"""

from pydantic_settings import BaseSettings
from pathlib import Path
import logging
import os

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    """Application settings from environment variables"""
    
    # Application
    APP_NAME: str = "Image-to-Document API"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # File Upload
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    
    # --- VERCEL COMPATIBILITY START ---
    # We use /tmp because it's the only writable directory on Vercel functions
    BASE_DIR: str = "/tmp" if os.environ.get("VERCEL") else "uploads"
    
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "temp")
    OUTPUT_DIR: str = os.path.join(BASE_DIR, "output")
    SESSION_DIR: str = os.path.join(BASE_DIR, "sessions")
    # --- VERCEL COMPATIBILITY END ---

    ALLOWED_EXTENSIONS: set = {"jpg", "jpeg", "png", "gif", "webp"}
    
    # Session Management
    SESSION_TTL: int = 3600  # 1 hour in seconds
    CLEANUP_INTERVAL: int = 300  # Cleanup every 5 minutes
    
    # CORS
    CORS_ORIGINS: list = ["*"]
    
    # Grid Layout Defaults
    DEFAULT_GRID_COLS: int = 2
    DEFAULT_PAGE_SIZE: str = "A4"
    
    # Database (optional)
    DATABASE_URL: str = "sqlite:///./app.db"
    
    class Config:
        """Pydantic config"""
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()

# Create directories if they don't exist
# This is crucial on Vercel because /tmp starts empty for every new execution
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.SESSION_DIR).mkdir(parents=True, exist_ok=True)

logger.info(f"Upload dir: {settings.UPLOAD_DIR}")
logger.info(f"Output dir: {settings.OUTPUT_DIR}")