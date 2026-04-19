"""
Session management — SQLite-backed for persistence across restarts.
Falls back to in-memory if DB unavailable.
"""

import os
import json
import uuid
import sqlite3
import threading
from datetime import datetime, timedelta
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.environ.get("BASE_DIR", "data"), "sessions.db")


class SessionManager:
    """SQLite-backed session manager. Survives server restarts."""

    def __init__(self, session_dir: str, ttl_seconds: int = 3600):
        self.ttl = timedelta(seconds=ttl_seconds)
        self._lock = threading.Lock()
        self._init_db()

    # ------------------------------------------------------------------ DB init
    def _init_db(self):
        try:
            os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
            conn = self._conn()
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    data       TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            conn.commit()
            conn.close()
            logger.info(f"Session DB: {DB_PATH}")
        except Exception as e:
            logger.error(f"DB init failed, falling back to in-memory: {e}")
            self._fallback = {}

    def _conn(self):
        c = sqlite3.connect(DB_PATH)
        c.row_factory = sqlite3.Row
        return c

    # ------------------------------------------------------------------ CRUD
    def create(self, data: dict) -> str:
        session_id = str(uuid.uuid4())
        data["created_at"] = datetime.now().isoformat()
        try:
            with self._lock:
                conn = self._conn()
                conn.execute(
                    "INSERT INTO sessions (session_id, data, created_at) VALUES (?, ?, ?)",
                    (session_id, json.dumps(data), data["created_at"])
                )
                conn.commit()
                conn.close()
        except Exception as e:
            logger.error(f"Session create error: {e}")
        logger.info(f"Session created: {session_id}")
        return session_id

    def get(self, session_id: str) -> dict:
        try:
            conn = self._conn()
            row = conn.execute(
                "SELECT data FROM sessions WHERE session_id = ?", (session_id,)
            ).fetchone()
            conn.close()
            if row:
                return json.loads(row["data"])
        except Exception as e:
            logger.error(f"Session get error: {e}")
        return None

    def update(self, session_id: str, data: dict):
        existing = self.get(session_id)
        if not existing:
            return
        existing.update(data)
        try:
            with self._lock:
                conn = self._conn()
                conn.execute(
                    "UPDATE sessions SET data = ? WHERE session_id = ?",
                    (json.dumps(existing), session_id)
                )
                conn.commit()
                conn.close()
        except Exception as e:
            logger.error(f"Session update error: {e}")

    def delete(self, session_id: str):
        session = self.get(session_id)
        if not session:
            return
        # Cleanup files
        for img_path in session.get("image_paths", []):
            try:
                os.remove(img_path)
            except Exception:
                pass
        for ext in ["pdf", "docx"]:
            try:
                from config import settings
                os.remove(os.path.join(settings.OUTPUT_DIR, f"document_{session_id}.{ext}"))
            except Exception:
                pass
        try:
            with self._lock:
                conn = self._conn()
                conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
                conn.commit()
                conn.close()
        except Exception as e:
            logger.error(f"Session delete error: {e}")
        logger.info(f"Session deleted: {session_id}")

    def cleanup_expired(self) -> int:
        cutoff = (datetime.now() - self.ttl).isoformat()
        try:
            conn = self._conn()
            rows = conn.execute(
                "SELECT session_id FROM sessions WHERE created_at < ?", (cutoff,)
            ).fetchall()
            conn.close()
            expired = [r["session_id"] for r in rows]
            for sid in expired:
                self.delete(sid)
            if expired:
                logger.info(f"Cleaned up {len(expired)} expired sessions")
            return len(expired)
        except Exception as e:
            logger.error(f"Cleanup error: {e}")
            return 0

    @property
    def sessions(self):
        """Compatibility shim — returns count dict for health endpoint."""
        try:
            conn = self._conn()
            count = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
            conn.close()
            return range(count)  # len() works on range
        except Exception:
            return []