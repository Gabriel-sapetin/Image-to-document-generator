"""
Word document generation using python-docx
"""

import logging
from typing import List
from datetime import datetime

from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

logger = logging.getLogger(__name__)


class WordGenerator:
    """Generate Word documents with images vertically stacked"""
    
    def generate(
        self,
        pages: List[List[dict]],
        output_path: str,
        title: str = "Image Collection"
    ) -> str:
        """
        Generate Word document with 2 large images per page
        
        Args:
            pages: List of pages with image data
            output_path: Output file path
            title: Document title
        """
        doc = Document()

        # Adjust margins to give images more room (0.5 inch margins)
        sections = doc.sections
        for section in sections:
            section.top_margin = Inches(0.5)
            section.bottom_margin = Inches(0.5)
            section.left_margin = Inches(0.5)
            section.right_margin = Inches(0.5)
        
        # Add centered Title
        title_para = doc.add_paragraph(title)
        title_para.style = 'Heading 1'
        title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Add timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        time_para = doc.add_paragraph(f"Generated on {timestamp}")
        time_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Add each page from the 'pages' list
        for page_num, page_images in enumerate(pages):
            if page_num > 0:
                doc.add_page_break()
            
            # Add images as a vertical stack
            for i, img_data in enumerate(page_images):
                try:
                    para = doc.add_paragraph()
                    run = para.add_run()
                    
                    # Width=Inches(7) allows the screenshot to fill 
                    # most of the A4/Letter width (8.5 inches)
                    run.add_picture(img_data['filepath'], width=Inches(7))
                    
                    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    
                    # Add a little spacing between the two images on the same page
                    if i == 0 and len(page_images) > 1:
                        doc.add_paragraph() 
                        
                except Exception as e:
                    logger.error(f"Failed to insert {img_data.get('filepath')}: {e}")
        
        doc.save(output_path)
        logger.info(f"Word document saved: {output_path}")
        return output_path