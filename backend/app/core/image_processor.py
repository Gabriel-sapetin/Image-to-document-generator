"""
Image processing: metadata extraction and smart sequencing
"""

import os
from pathlib import Path
from datetime import datetime
from typing import List, Optional
import logging

from PIL import Image
import piexif

logger = logging.getLogger(__name__)


class MetadataExtractor:
    """Extract image metadata including EXIF timestamps"""
    
    @staticmethod
    def extract(image_path: str) -> dict:
        """
        Extract comprehensive metadata from image
        
        Returns:
            {
                'filename': str,
                'width': int,
                'height': int,
                'aspect_ratio': float,
                'format': str,
                'creation_timestamp': float (unix timestamp),
                'exif_datetime': str or None,
                'file_mtime': float
            }
        """
        image_path = str(image_path)
        
        try:
            image = Image.open(image_path)
            
            metadata = {
                'filename': os.path.basename(image_path),
                'filepath': image_path,
                'width': image.width,
                'height': image.height,
                'aspect_ratio': image.width / image.height if image.height > 0 else 1.0,
                'format': image.format or 'UNKNOWN',
                'creation_timestamp': os.path.getmtime(image_path),
                'file_mtime': os.path.getmtime(image_path),
                'exif_datetime': None
            }
            
            # Try to extract EXIF
            try:
                exif_dict = piexif.load(image_path)
                exif_ifd = exif_dict.get("0th", {})
                
                # Try DateTimeOriginal first (more reliable)
                if "Exif" in exif_dict and piexif.ExifIFD.DateTimeOriginal in exif_dict["Exif"]:
                    dt_str = exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal]
                    if isinstance(dt_str, bytes):
                        dt_str = dt_str.decode('utf-8')
                    
                    try:
                        dt = datetime.strptime(dt_str, '%Y:%m:%d %H:%M:%S')
                        metadata['creation_timestamp'] = dt.timestamp()
                        metadata['exif_datetime'] = dt_str
                        logger.debug(f"EXIF DateTimeOriginal: {image_path} -> {dt_str}")
                    except ValueError:
                        pass
                
                # Fallback to DateTime
                if piexif.ImageIFD.DateTime in exif_ifd:
                    dt_str = exif_ifd[piexif.ImageIFD.DateTime]
                    if isinstance(dt_str, bytes):
                        dt_str = dt_str.decode('utf-8')
                    
                    if not metadata['exif_datetime']:  # Only if we didn't get DateTimeOriginal
                        try:
                            dt = datetime.strptime(dt_str, '%Y:%m:%d %H:%M:%S')
                            metadata['creation_timestamp'] = dt.timestamp()
                            metadata['exif_datetime'] = dt_str
                            logger.debug(f"EXIF DateTime: {image_path} -> {dt_str}")
                        except ValueError:
                            pass
                            
            except Exception as e:
                logger.debug(f"EXIF extraction failed: {e}, using file mtime")
            
            return metadata
            
        except Exception as e:
            logger.error(f"Failed to extract metadata from {image_path}: {e}")
            raise


class ImageSequencer:
    """Smart sequencing of images based on metadata"""
    
    @staticmethod
    def sequence(image_paths: List[str], preserve_order: bool = False) -> List[dict]:
        """
        Extract metadata and intelligently sequence images
        
        Priority:
        1. EXIF creation date (most reliable)
        2. File modification time
        3. Filename (alphabetically)
        4. Original upload order (if preserve_order=True)
        """
        metadata_list = []
        
        for idx, path in enumerate(image_paths):
            try:
                meta = MetadataExtractor.extract(path)
                meta['order_index'] = idx
                metadata_list.append(meta)
            except Exception as e:
                logger.error(f"Skipping {path}: {e}")
                continue
        
        if preserve_order:
            sequenced = sorted(metadata_list, key=lambda m: m['order_index'])
            logger.info("Using original upload order (preserve_order=True)")
        else:
            # Smart sort: timestamp > filename > order
            sequenced = sorted(
                metadata_list,
                key=lambda m: (m['creation_timestamp'], m['filename'], m['order_index'])
            )
            logger.info(f"Sequenced {len(sequenced)} images by timestamp")
        
        return sequenced