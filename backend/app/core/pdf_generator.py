"""
PDF generation using ReportLab
"""

import logging
from typing import List

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, letter

logger = logging.getLogger(__name__)


class PDFGenerator:
    """Generate PDFs with arranged images"""
    
    PAGE_SIZES = {
        'A4': A4,
        'LETTER': letter
    }
    
    def __init__(self, page_size: str = 'A4'):
        """Initialize PDF generator"""
        self.page_size = self.PAGE_SIZES.get(page_size.upper(), A4)
    
    def generate(
        self,
        pages: List[List[dict]],
        output_path: str,
        title: str = "Image Collection",
        include_page_numbers: bool = False
    ) -> str:
        """
        Generate PDF from positioned images
        
        Args:
            pages: List of pages with positioned images
            output_path: Output file path
            title: Document title
            include_page_numbers: Add page numbers
            
        Returns:
            Path to generated PDF
        """
        c = canvas.Canvas(output_path, pagesize=self.page_size)
        c.setTitle(title)
        c.setAuthor("Image-to-Document App")
        
        page_width, page_height = self.page_size
        
        for page_num, page_images in enumerate(pages):
            # Draw images
            # Note: coordinates are in points (1 point = 1/72 inch)
            # No need to convert with pt() - just use raw numbers
            for img_pos in page_images:
                try:
                    c.drawImage(
                        img_pos['filepath'],
                        img_pos['x'],  # x position in points
                        page_height - (img_pos['y'] + img_pos['height']),  # y position
                        width=img_pos['width'],  # width in points
                        height=img_pos['height'],  # height in points
                        preserveAspectRatio=True
                    )
                except Exception as e:
                    logger.error(f"Failed to draw {img_pos['filepath']}: {e}")
            
            # Add page numbers
            if include_page_numbers:
                c.setFont("Helvetica", 10)
                c.drawString(
                    page_width / 2 - 10,
                    20,
                    f"Page {page_num + 1} of {len(pages)}"
                )
            
            c.showPage()
        
        c.save()
        logger.info(f"PDF saved: {output_path}")
        return output_path