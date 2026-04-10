"""
Session management for upload tracking
"""

import os
import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class SessionManager:
    """Manage user sessions and cleanup"""
    
    def __init__(self, session_dir: str, ttl_seconds: int = 3600):
        """
        Initialize session manager
        
        Args:
            session_dir: Directory to store sessions
            ttl_seconds: Session time-to-live
        """
        self.session_dir = Path(session_dir)
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = timedelta(seconds=ttl_seconds)
        self.sessions = {}  # In-memory cache
    
    def create(self, data: dict) -> str:
        """Create new session"""
        session_id = str(uuid.uuid4())
        data['created_at'] = datetime.now().isoformat()
        self.sessions[session_id] = data
        logger.info(f"Session created: {session_id}")
        return session_id
    
    def get(self, session_id: str) -> dict:
        """Get session data"""
        return self.sessions.get(session_id)
    
    def update(self, session_id: str, data: dict) -> None:
        """Update session data"""
        if session_id in self.sessions:
            self.sessions[session_id].update(data)
    
    def delete(self, session_id: str) -> None:
        """Delete session and cleanup files"""
        if session_id not in self.sessions:
            return
        
        session = self.sessions[session_id]
        
        # Cleanup image files
        for img_path in session.get('image_paths', []):
            try:
                os.remove(img_path)
            except:
                pass
        
        # Cleanup output files
        for ext in ['pdf', 'docx']:
            filepath = f"uploads/output/document_{session_id}.{ext}"
            try:
                os.remove(filepath)
            except:
                pass
        
        del self.sessions[session_id]
        logger.info(f"Session deleted: {session_id}")
    
    def cleanup_expired(self) -> int:
        """Remove expired sessions"""
        now = datetime.now()
        expired = []
        
        for session_id, data in self.sessions.items():
            created_at = datetime.fromisoformat(data['created_at'])
            if now - created_at > self.ttl:
                expired.append(session_id)
        
        for session_id in expired:
            self.delete(session_id)
        
        if expired:
            logger.info(f"Cleaned up {len(expired)} expired sessions")
        
        return len(expired)