"""
Grid layout algorithm - main innovation
Preserves aspect ratios without distortion
"""

import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)


class GridLayoutEngine:
    """Calculate grid layout for images across multiple pages"""
    
    # Page sizes in points (1 point = 1/72 inch)
    PAGE_SIZES = {
        'A4': (595, 842),      # 210mm x 297mm
        'LETTER': (612, 792),  # 8.5" x 11"
    }
    
    MARGIN = 30  # points
    CELL_PADDING = 10  # points
    
    def __init__(self, page_size: str = 'A4', grid_cols: int = 2):
        """Initialize layout engine"""
        self.page_size = page_size
        self.grid_cols = max(1, min(4, grid_cols))
        self.page_width, self.page_height = self.PAGE_SIZES.get(
            page_size.upper(), 
            self.PAGE_SIZES['A4']
        )
        
        logger.info(f"Layout: {self.grid_cols} cols, {page_size} page")
    
    def _calculate_image_dimensions(
        self,
        aspect_ratio: float,
        max_width: float,
        max_height: float
    ) -> Tuple[float, float]:
        """
        Calculate image dimensions maintaining aspect ratio
        
        THE CORE ALGORITHM:
        - If cell is wider than image: height constrains
        - If cell is narrower than image: width constrains
        - Result: perfect fit with no distortion
        """
        img_width = max_width - self.CELL_PADDING
        img_height = max_height - self.CELL_PADDING
        
        # Determine constraint
        if (img_width / img_height) > aspect_ratio:
            # Cell is wider than image → height constrains
            final_height = img_height
            final_width = final_height * aspect_ratio
        else:
            # Cell is narrower than image → width constrains
            final_width = img_width
            final_height = final_width / aspect_ratio
        
        return final_width, final_height
    
    def layout(self, metadata_list: List[dict]) -> List[List[dict]]:
        """
        Arrange images into grid layout across multiple pages
        
        Returns: List of pages, each containing list of positioned images
        """
        if not metadata_list:
            logger.warning("No images to layout")
            return []
        
        # Calculate available space
        available_width = self.page_width - (self.MARGIN * 2)
        available_height = self.page_height - (self.MARGIN * 2)
        
        # Calculate grid dimensions
        total_images = len(metadata_list)
        grid_rows = -(-total_images // self.grid_cols)  # Ceiling division
        
        cell_width = available_width / self.grid_cols
        cell_height = available_height / grid_rows
        
        logger.info(
            f"Grid: {self.grid_cols} cols × {grid_rows} rows "
            f"({total_images} images on {-(-total_images // (self.grid_cols * grid_rows))} pages)"
        )
        
        # Build layout
        pages = []
        current_page = []
        images_per_page = self.grid_cols * grid_rows
        
        for idx, metadata in enumerate(metadata_list):
            # Check if new page needed
            if idx > 0 and idx % images_per_page == 0:
                pages.append(current_page)
                current_page = []
            
            # Position in current page
            position_in_page = idx % images_per_page
            row = position_in_page // self.grid_cols
            col = position_in_page % self.grid_cols
            
            # Calculate image dimensions
            img_width, img_height = self._calculate_image_dimensions(
                metadata['aspect_ratio'],
                cell_width,
                cell_height
            )
            
            # Center in cell
            x_offset = (cell_width - img_width) / 2
            y_offset = (cell_height - img_height) / 2
            
            x = self.MARGIN + (col * cell_width) + x_offset
            y = self.MARGIN + (row * cell_height) + y_offset
            
            position = {
                'filepath': metadata['filepath'],
                'x': x,
                'y': y,
                'width': img_width,
                'height': img_height,
                'page_num': len(pages)
            }
            
            current_page.append(position)
        
        # Add final page
        if current_page:
            pages.append(current_page)
        
        logger.info(f"Layout complete: {len(pages)} page(s)")
        return pages