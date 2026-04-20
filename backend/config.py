"""
Application configuration
Load settings from environment variables with defaults
"""

from pydantic_settings import BaseSettings
import logging
import os

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Image-to-Document API"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # File Upload
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB

    # These are defined as properties — ignore them if in .env
    UPLOAD_DIR: str = "uploads/temp"
    OUTPUT_DIR: str = "uploads/output"
    SESSION_DIR: str = "uploads/sessions"

    # Session Management
    SESSION_TTL: int = 3600
    CLEANUP_INTERVAL: int = 300

    # CORS
    CORS_ORIGINS: list = ["*"]

    # Grid Layout Defaults
    DEFAULT_GRID_COLS: int = 2
    DEFAULT_PAGE_SIZE: str = "A4"

    # Database (optional)
    DATABASE_URL: str = "sqlite:///./app.db"

    # Admin Dashboard
    ADMIN_TOKEN: str = "change-me-in-env"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # ignore unknown fields from .env


# Create settings instance
settings = Settings()

# Override dirs for Vercel
if os.environ.get("VERCEL"):
    settings.UPLOAD_DIR = "/tmp/temp"
    settings.OUTPUT_DIR = "/tmp/output"
    settings.SESSION_DIR = "/tmp/sessions"

# Create directories
for directory in [settings.UPLOAD_DIR, settings.OUTPUT_DIR, settings.SESSION_DIR]:
    if not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)
        logger.info(f"Created directory: {directory}")

logger.info(f"Storage base: {settings.UPLOAD_DIR}")