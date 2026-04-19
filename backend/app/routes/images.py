"""
API endpoints — with image count cap, file cleanup, size validation.
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
from app.core.image_processor import ImageSequencer
from app.core.pdf_generator import PDFGenerator
from app.core.docx_generator import WordGenerator
from app.utils.session_manager import SessionManager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["images"])
session_manager = SessionManager(settings.SESSION_DIR, settings.SESSION_TTL)
limiter = Limiter(key_func=get_remote_address)
executor = ThreadPoolExecutor(max_workers=4)

VALID_PAGE_SIZES = {"A4", "LETTER", "SHORT", "LONG"}
MAX_IMAGES = 50


def _cleanup_files(paths: list):
    """Delete files silently — used when upload is partially aborted."""
    for p in paths:
        try:
            os.remove(p)
        except Exception:
            pass


@router.post("/upload")
@limiter.limit("20/minute")
async def upload_images(
    request: Request,
    files: List[UploadFile] = File(...),
    grid_cols: int = Query(default=2, ge=1, le=4),
    page_size: str = Query(default="A4"),
    document_title: str = Query(default="Image Collection"),
    preserve_order: bool = Query(default=True)
):
    if page_size.upper() not in VALID_PAGE_SIZES:
        raise HTTPException(400, detail=f"Invalid page_size. Use: {VALID_PAGE_SIZES}")

    if len(files) > MAX_IMAGES:
        raise HTTPException(400, detail=f"Max {MAX_IMAGES} images per request.")

    image_paths = []
    skipped = 0

    try:
        for file in files:
            if not file.filename:
                continue
            if not (file.content_type or '').startswith('image/'):
                skipped += 1
                continue

            # Read first to check size before writing
            content = await file.read()

            if len(content) > settings.MAX_FILE_SIZE:
                skipped += 1
                logger.warning(f"Skipped oversized file: {file.filename} ({len(content)} bytes)")
                continue

            # Validate it's actually an image by checking magic bytes
            if not _is_image_bytes(content):
                skipped += 1
                logger.warning(f"Rejected non-image file: {file.filename}")
                continue

            filename = f"{os.urandom(8).hex()}_{os.path.basename(file.filename)}"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)

            with open(filepath, 'wb') as f:
                f.write(content)

            image_paths.append(filepath)

        if not image_paths:
            raise HTTPException(400, detail="No valid images uploaded.")

        loop = asyncio.get_event_loop()
        sequenced = await loop.run_in_executor(
            executor,
            lambda: ImageSequencer.sequence(image_paths, preserve_order)
        )

        images_per_page = grid_cols * 2
        pages = ImageSequencer.paginate(sequenced, images_per_page=images_per_page)

        session_id = session_manager.create({
            'image_paths': image_paths,
            'grid_cols': grid_cols,
            'page_size': page_size.upper(),
            'document_title': document_title,
            'pages': pages,
            'metadata': sequenced
        })

        return UploadResponse(
            session_id=session_id,
            image_count=len(image_paths),
            page_count=len(pages),
            grid_cols=grid_cols,
            page_size=page_size
        )

    except HTTPException:
        _cleanup_files(image_paths)
        raise
    except Exception as e:
        _cleanup_files(image_paths)
        logger.error(f"Upload error: {e}")
        raise HTTPException(500, detail=str(e))


def _is_image_bytes(data: bytes) -> bool:
    """Check magic bytes for common image formats."""
    magic = {
        b'\xff\xd8\xff': 'jpeg',
        b'\x89PNG': 'png',
        b'GIF8': 'gif',
        b'RIFF': 'webp',  # RIFF....WEBP
        b'\x00\x00\x01\x00': 'ico',
        b'BM': 'bmp',
    }
    for sig in magic:
        if data[:len(sig)] == sig:
            return True
    # WEBP: check bytes 8-12
    if len(data) >= 12 and data[8:12] == b'WEBP':
        return True
    return False


@router.post("/generate-pdf")
@limiter.limit("10/minute")
async def generate_pdf(request: Request, body: GeneratePDFRequest):
    try:
        session = session_manager.get(body.session_id)
        if not session:
            raise HTTPException(404, detail="Session not found or expired.")

        output_filename = f"document_{body.session_id}.pdf"
        output_path = os.path.join(settings.OUTPUT_DIR, output_filename)

        pdf_gen = PDFGenerator(session['page_size'])
        grid_cols = session.get('grid_cols', 2)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            executor,
            lambda: pdf_gen.generate(
                session['pages'],
                output_path,
                title=body.document_title,
                include_page_numbers=False,
                grid_cols=grid_cols
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
        raise HTTPException(500, detail=str(e))


@router.post("/generate-docx")
@limiter.limit("10/minute")
async def generate_docx(request: Request, body: GenerateDocxRequest):
    try:
        session = session_manager.get(body.session_id)
        if not session:
            raise HTTPException(404, detail="Session not found or expired.")

        output_filename = f"document_{body.session_id}.docx"
        output_path = os.path.join(settings.OUTPUT_DIR, output_filename)

        word_gen = WordGenerator()
        grid_cols = session.get('grid_cols', 2)
        page_size = session.get('page_size', 'A4')

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            executor,
            lambda: word_gen.generate(
                session['pages'],
                output_path,
                title=body.document_title,
                grid_cols=grid_cols,
                page_size=page_size
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
        raise HTTPException(500, detail=str(e))


@router.get("/download/{session_id}/{file_type}")
@limiter.limit("30/minute")
async def download_file(request: Request, session_id: str, file_type: str):
    if file_type not in ("pdf", "docx"):
        raise HTTPException(400, detail="Invalid file type.")

    filename = f"document_{session_id}.{file_type}"
    filepath = os.path.join(settings.OUTPUT_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(404, detail="File not found or already cleaned up.")

    return FileResponse(path=filepath, filename=filename, media_type='application/octet-stream')


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    session_manager.delete(session_id)
    return {"deleted": session_id}


@router.get("/health")
async def health_check():
    return {
        'status': 'ok',
        'active_sessions': len(session_manager.sessions),
        'max_images_per_upload': MAX_IMAGES,
        'thread_pool_workers': executor._max_workers
    }