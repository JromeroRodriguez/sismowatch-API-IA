"""Database connection utilities for SismoWatch pipelines.

Follows the Principle of Least Privilege:
- get_ingest_connection(): connects as sismo_ingest (bronze schema only)
- get_transform_connection(): connects as sismo_transform (bronze read, silver/gold read/write)
- get_readonly_connection(): connects as sismo_readonly (gold schema read-only)
"""

import os
from contextlib import contextmanager
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values


def get_db_config(role: str = "transform") -> dict:
    host = os.getenv("POSTGRES_HOST", "postgres")
    port = int(os.getenv("POSTGRES_PORT", "5432"))
    database = os.getenv("POSTGRES_DB", "sismowatch")

    if role == "ingest":
        user = os.getenv("DB_INGEST_USER", "sismo_ingest")
        password = os.getenv("DB_INGEST_PASSWORD", "admin123")
    elif role == "readonly":
        user = os.getenv("DB_READONLY_USER", "sismo_readonly")
        password = os.getenv("DB_READONLY_PASSWORD", "admin123")
    else:  # transform
        user = os.getenv("DB_TRANSFORM_USER", "sismo_transform")
        password = os.getenv("DB_TRANSFORM_PASSWORD", "admin123")

    return {
        "host": host,
        "port": port,
        "database": database,
        "user": user,
        "password": password,
    }


@contextmanager
def get_db_connection(role: str = "transform"):
    """Context manager for acquiring and safely closing database connections."""
    config = get_db_config(role=role)
    conn = psycopg2.connect(**config)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_transform_db_cursor():
    """Context manager yielding RealDictCursor with sismo_transform privileges."""
    with get_db_connection(role="transform") as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
