"""Database access layer for FastAPI.

Strictly connects using the least-privilege role 'sismo_readonly'
which has SELECT access ONLY on the 'gold' schema.
"""

from contextlib import contextmanager
import logging
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from config import settings

logger = logging.getLogger("sismowatch.api.database")

# Initialize connection pool
_db_pool: pool.SimpleConnectionPool | None = None


def get_pool() -> pool.SimpleConnectionPool:
    global _db_pool
    if _db_pool is None or _db_pool.closed:
        _db_pool = pool.SimpleConnectionPool(
            minconn=1,
            maxconn=10,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            dbname=settings.POSTGRES_DB,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            connect_timeout=5,
        )
    return _db_pool


@contextmanager
def get_db_cursor():
    """Context manager acquiring a connection from pool and yielding RealDictCursor."""
    p = get_pool()
    conn = p.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
        conn.commit()
    except Exception as exc:
        conn.rollback()
        logger.error(f"Database query error: {exc}")
        raise
    finally:
        p.putconn(conn)


def fetch_all(query: str, params: tuple | dict | None = None) -> list[dict]:
    """Execute a query and return all matching rows as dictionaries."""
    with get_db_cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()
        return [dict(row) for row in rows]


def fetch_one(query: str, params: tuple | dict | None = None) -> dict | None:
    """Execute a query and return a single row or None."""
    with get_db_cursor() as cur:
        cur.execute(query, params)
        row = cur.fetchone()
        return dict(row) if row else None
