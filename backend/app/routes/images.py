"""
API endpoints for image processing with Vertical Pagination.
Includes rate limiting (slowapi) and thread pool for CPU-heavy tasks.
"""

import os
import asyncio
from typing import List
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Request
from fastapi.responses import FileResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

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

# Rate limiter — same key function as main.py
limiter = Limiter(key_func=get_remote_address)

# Thread pool — 4 workers handle 4 simultaneous PDF/Word generations
# Without this, one slow generation blocks ALL other users
executor = ThreadPoolExecutor(max_workers=4)


@router.post("/upload")
@limiter.limit("20/minute")  # max 20 uploads per minute per IP
async def upload_images(
    request: Request,  # required by slowapi
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

        # Run sequencing in thread pool (Pillow/EXIF reading is CPU-bound)
        loop = asyncio.get_event_loop()
        sequenced = await loop.run_in_executor(
            executor,
            lambda: ImageSequencer.sequence(image_paths, preserve_order)
        )
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
@limiter.limit("10/minute")  # max 10 PDF generations per minute per IP
async def generate_pdf(request: Request, body: GeneratePDFRequest):
    """Generate PDF from paginated session — runs in thread pool"""
    try:
        session = session_manager.get(body.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        output_filename = f"document_{body.session_id}.pdf"
        output_path = os.path.join(settings.OUTPUT_DIR, output_filename)

        pdf_gen = PDFGenerator(session['page_size'])

        # PDF generation is CPU-heavy (ReportLab + image processing)
        # Running it in the thread pool means other users aren't blocked
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            executor,
            lambda: pdf_gen.generate(
                session['pages'],
                output_path,
                title=body.document_title,
                include_page_numbers=body.include_page_numbers
            )
        )

        logger.info(f"PDF generated: {output_filename}")
        return DocumentResponse(
            file_id=f"pdf_{body.session_id}",
            download_url=f"/api/download/{body.session_id}/pdf",
            size_bytes=os.path.getsize(output_path),
            filename=output_filename
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-docx")
@limiter.limit("10/minute")  # max 10 Word generations per minute per IP
async def generate_docx(request: Request, body: GenerateDocxRequest):
    """Generate Word document from paginated session — runs in thread pool"""
    try:
        session = session_manager.get(body.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        output_filename = f"document_{body.session_id}.docx"
        output_path = os.path.join(settings.OUTPUT_DIR, output_filename)

        word_gen = WordGenerator()

        # Word generation is CPU-heavy (python-docx + image embedding)
        # Thread pool keeps the server responsive for other users
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            executor,
            lambda: word_gen.generate(
                session['pages'],
                output_path,
                title=body.document_title
            )
        )

        logger.info(f"DOCX generated: {output_filename}")
        return DocumentResponse(
            file_id=f"docx_{body.session_id}",
            download_url=f"/api/download/{body.session_id}/docx",
            size_bytes=os.path.getsize(output_path),
            filename=output_filename
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Word error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{session_id}/{file_type}")
@limiter.limit("30/minute")  # generous limit for downloads
async def download_file(request: Request, session_id: str, file_type: str):
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
        'active_sessions': len(session_manager.sessions),
        'thread_pool_workers': executor._max_workers
    }