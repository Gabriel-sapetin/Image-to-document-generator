"""
PDF generation using ReportLab with Vertical Stacking
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
        include_page_numbers: bool = True
    ) -> str:
        """
        Generate PDF from positioned images in a vertical stack (2 per page)
        
        Args:
            pages: List of pages, each containing a list of image data
            output_path: Where to save the file
            title: Metadata title for the PDF
            include_page_numbers: Toggle for footer page numbers
        """
        c = canvas.Canvas(output_path, pagesize=self.page_size)
        c.setTitle(title)
        c.setAuthor("Image-to-Document App")
        
        page_width, page_height = self.page_size
        
        # Define layout constants
        margin = 40 
        spacing = 30  # Space between the top and bottom image
        
        # Calculate how much room we actually have to draw
        usable_width = page_width - (margin * 2)
        # (Total height - margins - middle spacing) divided by 2 images
        usable_height_per_image = (page_height - (margin * 2) - spacing) / 2

        for page_num, page_images in enumerate(pages):
            # Loop through the images on the current page (max 2)
            for i, img_data in enumerate(page_images):
                try:
                    # COORDINATE MATH:
                    # If i=0 (Top Image): Position it in the upper half
                    # If i=1 (Bottom Image): Position it in the lower half
                    if i == 0:
                        # Bottom edge of the top image
                        y_pos = margin + usable_height_per_image + spacing
                    else:
                        # Bottom edge of the bottom image
                        y_pos = margin

                    c.drawImage(
                        img_data['filepath'],
                        margin,                # X position (left margin)
                        y_pos,                 # Y position (calculated above)
                        width=usable_width,
                        height=usable_height_per_image,
                        preserveAspectRatio=True
                    )
                except Exception as e:
                    logger.error(f"Failed to draw {img_data.get('filepath')}: {e}")
            
            # Footer / Page Numbers
            if include_page_numbers:
                c.setFont("Helvetica", 10)
                c.drawCentredString(
                    page_width / 2, 
                    25, 
                    f"Page {page_num + 1} of {len(pages)}"
                )
            
            # Finish the current page and move to the next
            c.showPage()
        
        c.save()
        logger.info(f"PDF successfully saved to: {output_path}")
        return output_path