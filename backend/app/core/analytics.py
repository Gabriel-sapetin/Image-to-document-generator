"""
Analytics tracker — SQLite-backed.
Tracks: uploads, document generations, unique IPs per day.
"""

import os
import sqlite3
import threading
from datetime import datetime, date
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.environ.get("BASE_DIR", "data"), "analytics.db")


class Analytics:
    _lock = threading.Lock()

    @classmethod
    def _conn(cls):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        c = sqlite3.connect(DB_PATH)
        c.row_factory = sqlite3.Row
        return c

    @classmethod
    def init(cls):
        conn = cls._conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS events (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                event      TEXT NOT NULL,
                ip         TEXT,
                meta       TEXT,
                ts         TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
            CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);

            CREATE TABLE IF NOT EXISTS donations (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                donor_name TEXT NOT NULL,
                amount     REAL NOT NULL,
                method     TEXT NOT NULL,
                note       TEXT,
                ts         TEXT NOT NULL
            );
        """)
        conn.commit()
        conn.close()
        logger.info(f"Analytics DB ready: {DB_PATH}")

    @classmethod
    def track(cls, event: str, ip: str = None, meta: str = None):
        try:
            with cls._lock:
                conn = cls._conn()
                conn.execute(
                    "INSERT INTO events (event, ip, meta, ts) VALUES (?, ?, ?, ?)",
                    (event, ip, meta, datetime.utcnow().isoformat())
                )
                conn.commit()
                conn.close()
        except Exception as e:
            logger.error(f"Analytics track error: {e}")

    # ---------------------------------------------------------------- queries

    @classmethod
    def stats_monthly(cls):
        """Returns per-month stats for last 6 months."""
        conn = cls._conn()
        rows = conn.execute("""
            SELECT
                strftime('%Y-%m', ts) AS month,
                COUNT(*) FILTER (WHERE event = 'upload') AS uploads,
                COUNT(*) FILTER (WHERE event = 'pdf_generated') AS pdfs,
                COUNT(*) FILTER (WHERE event = 'docx_generated') AS docxs,
                COUNT(DISTINCT ip) FILTER (WHERE event = 'upload') AS unique_users
            FROM events
            WHERE ts >= date('now', '-6 months')
            GROUP BY month
            ORDER BY month DESC
        """).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @classmethod
    def stats_today(cls):
        today = date.today().isoformat()
        conn = cls._conn()
        row = conn.execute("""
            SELECT
                COUNT(*) FILTER (WHERE event = 'upload') AS uploads,
                COUNT(*) FILTER (WHERE event = 'pdf_generated') AS pdfs,
                COUNT(*) FILTER (WHERE event = 'docx_generated') AS docxs,
                COUNT(DISTINCT ip) AS active_users
            FROM events
            WHERE date(ts) = ?
        """, (today,)).fetchone()
        conn.close()
        return dict(row) if row else {}

    @classmethod
    def stats_active_now(cls):
        """Unique IPs in last 15 minutes."""
        conn = cls._conn()
        row = conn.execute("""
            SELECT COUNT(DISTINCT ip) AS active_now
            FROM events
            WHERE ts >= datetime('now', '-15 minutes')
        """).fetchone()
        conn.close()
        return row["active_now"] if row else 0

    @classmethod
    def donations_list(cls):
        conn = cls._conn()
        rows = conn.execute(
            "SELECT * FROM donations ORDER BY ts DESC"
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @classmethod
    def donation_total(cls):
        conn = cls._conn()
        row = conn.execute("SELECT COALESCE(SUM(amount),0) AS total FROM donations").fetchone()
        conn.close()
        return row["total"] if row else 0

    @classmethod
    def add_donation(cls, donor_name: str, amount: float, method: str, note: str = ""):
        with cls._lock:
            conn = cls._conn()
            conn.execute(
                "INSERT INTO donations (donor_name, amount, method, note, ts) VALUES (?,?,?,?,?)",
                (donor_name, amount, method, note, datetime.utcnow().isoformat())
            )
            conn.commit()
            conn.close()

    @classmethod
    def delete_donation(cls, donation_id: int):
        with cls._lock:
            conn = cls._conn()
            conn.execute("DELETE FROM donations WHERE id = ?", (donation_id,))
            conn.commit()
            conn.close()