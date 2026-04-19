"""
PDF generation using ReportLab with Grid Support
"""

import logging
from typing import List
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, letter

logger = logging.getLogger(__name__)

LONG = (612, 936)
SHORT = letter

class PDFGenerator:
    """Generate PDFs with arranged images"""
    
    PAGE_SIZES = {
        'A4': A4,
        'LETTER': letter,
        'LONG': LONG,
        'SHORT': SHORT,
    }
    
    def __init__(self, page_size: str = 'A4'):
        self.page_size = self.PAGE_SIZES.get(page_size.upper(), A4)
    
    def generate(
        self,
        pages: List[List[dict]],
        output_path: str,
        title: str = "Image Collection",
        include_page_numbers: bool = False,
        grid_cols: int = 2
    ) -> str:
        c = canvas.Canvas(output_path, pagesize=self.page_size)
        c.setTitle(title)
        c.setAuthor("Image-to-Document App")
        
        page_width, page_height = self.page_size
        margin = 30
        cell_padding = 8

        for page_num, page_images in enumerate(pages):
            count = len(page_images)
            cols = min(grid_cols, count)
            rows = -(-count // cols)

            usable_width = page_width - (margin * 2)
            usable_height = page_height - (margin * 2)

            cell_width = usable_width / cols
            cell_height = usable_height / rows

            for i, img_data in enumerate(page_images):
                try:
                    row = i // cols
                    col = i % cols

                    x = margin + col * cell_width + cell_padding / 2
                    y_pos = (page_height - margin
                             - (row + 1) * cell_height
                             + cell_padding / 2)

                    draw_w = cell_width - cell_padding
                    draw_h = cell_height - cell_padding

                    c.drawImage(
                        img_data['filepath'],
                        x,
                        y_pos,
                        width=draw_w,
                        height=draw_h,
                        preserveAspectRatio=True,
                        anchor='c'
                    )
                except Exception as e:
                    logger.error(f"Failed to draw {img_data.get('filepath')}: {e}")

            c.showPage()

        c.save()
        logger.info(f"PDF saved: {output_path}")
        return output_path