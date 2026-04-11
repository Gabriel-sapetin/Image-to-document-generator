"""
API endpoints for image processing with Vertical Pagination
"""

import os
from typing import List
import logging

from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from fastapi.responses import FileResponse

from config import settings
from app.models.schemas import (
    UploadResponse, GeneratePDFRequest, GenerateDocxRequest, DocumentResponse
)
from app.core.image_processor import ImageSequencer, MetadataExtractor
from app.core.pdf_generator import PDFGenerator
from app.core.docx_generator import WordGenerator
from app.utils.session_manager import SessionManager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["images"])
session_manager = SessionManager(settings.SESSION_DIR, settings.SESSION_TTL)


@router.post("/upload")
async def upload_images(
    files: List[UploadFile] = File(...),
    grid_cols: int = Query(default=2, ge=1, le=4),
    page_size: str = Query(default="A4"),
    document_title: str = Query(default="Image Collection"),
    preserve_order: bool = Query(default=False)
):
    """Upload images and create session with 2-image vertical pagination"""
    try:
        image_paths = []
        image_count = 0

        for file in files:
            if not file.filename:
                continue
            if not file.content_type.startswith('image/'):
                continue

            filename = f"{os.urandom(8).hex()}_{file.filename}"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)

            content = await file.read()
            if len(content) > settings.MAX_FILE_SIZE:
                raise HTTPException(status_code=413, detail="File too large")

            with open(filepath, 'wb') as f:
                f.write(content)

            image_paths.append(filepath)
            image_count += 1

        if image_count == 0:
            raise HTTPException(status_code=400, detail="No valid images")

        sequenced = ImageSequencer.sequence(image_paths, preserve_order)
        pages = ImageSequencer.paginate(sequenced, images_per_page=2)

        session_id = session_manager.create({
            'image_paths': image_paths,
            'grid_cols': grid_cols,
            'page_size': page_size,
            'document_title': document_title,
            'pages': pages,
            'metadata': sequenced
        })

        return UploadResponse(
            session_id=session_id,
            image_count=image_count,
            page_count=len(pages),
            grid_cols=grid_cols,
            page_size=page_size
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-pdf")
async def generate_pdf(request: GeneratePDFRequest):
    """Generate PDF from paginated session"""
    try:
        session = session_manager.get(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        output_filename = f"document_{request.session_id}.pdf"
        output_path = os.path.join(settings.OUTPUT_DIR, output_filename)

        pdf_gen = PDFGenerator(session['page_size'])
        pdf_gen.generate(
            session['pages'],
            output_path,
            title=request.document_title,
            include_page_numbers=request.include_page_numbers
        )

        return DocumentResponse(
            file_id=f"pdf_{request.session_id}",
            download_url=f"/api/download/{request.session_id}/pdf",
            size_bytes=os.path.getsize(output_path),
            filename=output_filename
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-docx")
async def generate_docx(request: GenerateDocxRequest):
    """Generate Word document from paginated session"""
    try:
        session = session_manager.get(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        output_filename = f"document_{request.session_id}.docx"
        output_path = os.path.join(settings.OUTPUT_DIR, output_filename)

        word_gen = WordGenerator()
        word_gen.generate(
            session['pages'],
            output_path,
            title=request.document_title
        )

        return DocumentResponse(
            file_id=f"docx_{request.session_id}",
            download_url=f"/api/download/{request.session_id}/docx",
            size_bytes=os.path.getsize(output_path),
            filename=output_filename
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Word error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{session_id}/{file_type}")
async def download_file(session_id: str, file_type: str):
    """Download generated document"""
    try:
        if file_type == "pdf":
            filename = f"document_{session_id}.pdf"
        elif file_type == "docx":
            filename = f"document_{session_id}.docx"
        else:
            raise HTTPException(status_code=400, detail="Invalid file type")

        filepath = os.path.join(settings.OUTPUT_DIR, filename)

        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="File not found")

        return FileResponse(
            path=filepath,
            filename=filename,
            media_type='application/octet-stream'
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Download error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        'status': 'ok',
        'active_sessions': len(session_manager.sessions)
    }