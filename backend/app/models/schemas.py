"""
Pydantic schemas for API request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UploadRequest(BaseModel):
    """Upload request metadata"""
    grid_cols: int = Field(default=2, ge=1, le=4)
    page_size: str = Field(default="A4")
    document_title: str = Field(default="Image Collection")
    preserve_order: bool = Field(default=False)


class UploadResponse(BaseModel):
    """Upload response with session info"""
    session_id: str
    image_count: int
    page_count: int
    grid_cols: int
    page_size: str
    preview_urls: List[str] = []


class GeneratePDFRequest(BaseModel):
    """PDF generation request"""
    session_id: str
    document_title: str = "Image Collection"
    include_page_numbers: bool = True


class GenerateDocxRequest(BaseModel):
    """Word document generation request"""
    session_id: str
    document_title: str = "Image Collection"


class DocumentResponse(BaseModel):
    """Document generation response"""
    file_id: str
    download_url: str
    size_bytes: int
    filename: str


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    active_sessions: int
    timestamp: datetime


class ImageMetadata(BaseModel):
    """Image metadata"""
    filename: str
    width: int
    height: int
    aspect_ratio: float
    creation_timestamp: float
    exif_datetime: Optional[str] = None