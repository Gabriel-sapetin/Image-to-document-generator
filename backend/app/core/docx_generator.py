"""
Word document generation using python-docx
"""

import logging
from typing import List
from datetime import datetime

from docx import Document
from docx.shared import Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

logger = logging.getLogger(__name__)


class WordGenerator:
    """Generate Word documents with images"""
    
    def generate(
        self,
        pages: List[List[dict]],
        output_path: str,
        title: str = "Image Collection"
    ) -> str:
        """
        Generate Word document from positioned images
        
        Args:
            pages: List of pages with positioned images
            output_path: Output file path
            title: Document title
            
        Returns:
            Path to generated Word file
        """
        doc = Document()
        
        # Add title
        title_para = doc.add_paragraph(title)
        title_para.style = 'Heading 1'
        title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Add timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        doc.add_paragraph(f"Generated on {timestamp}").style = 'Normal'
        
        doc.add_paragraph()  # Spacing
        
        # Add each page
        for page_num, page_images in enumerate(pages):
            if page_num > 0:
                doc.add_page_break()
            
            doc.add_paragraph(f"Page {page_num + 1}").style = 'Heading 2'
            
            # Add images as rows
            for img_pos in page_images:
                try:
                    para = doc.add_paragraph()
                    run = para.add_run()
                    run.add_picture(img_pos['filepath'], width=Inches(4))
                    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                except Exception as e:
                    logger.error(f"Failed to insert {img_pos['filepath']}: {e}")
        
        doc.save(output_path)
        logger.info(f"Word document saved: {output_path}")
        return output_path