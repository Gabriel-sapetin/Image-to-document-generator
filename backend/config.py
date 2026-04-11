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
    # Determine the writable base directory
    @property
    def BASE_DIR(self) -> str:
        return "/tmp" if os.environ.get("VERCEL") else "data"
    
    @property
    def UPLOAD_DIR(self) -> str:
        return os.path.join(self.BASE_DIR, "temp")
        
    @property
    def OUTPUT_DIR(self) -> str:
        return os.path.join(self.BASE_DIR, "output")
        
    @property
    def SESSION_DIR(self) -> str:
        return os.path.join(self.BASE_DIR, "sessions")
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
    
    class Config:
        """Pydantic config"""
        env_file = ".env"
        case_sensitive = True

# Create settings instance
settings = Settings()

# CRITICAL: Create directories immediately
# On Vercel, the /tmp directory is empty every time the function wakes up
for directory in [settings.UPLOAD_DIR, settings.OUTPUT_DIR, settings.SESSION_DIR]:
    if not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)
        logger.info(f"Created directory: {directory}")

logger.info(f"Storage base: {settings.BASE_DIR}")