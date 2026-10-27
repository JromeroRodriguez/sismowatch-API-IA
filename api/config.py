"""Application configuration loaded from environment variables."""

import os
from typing import List


class Settings:
    # Database (strictly connects as read-only user to postgres)
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "postgres")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "sismowatch")
    POSTGRES_USER: str = os.getenv("DB_READONLY_USER", "sismo_readonly")
    POSTGRES_PASSWORD: str = os.getenv("DB_READONLY_PASSWORD", "admin123")

    # JWT Authentication
    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY", "sismowatch-dev-insecure-jwt-key-change-in-production"
    )
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    )

    # Initial platform credentials (seeded from .env, never hardcoded)
    PLATFORM_ADMIN_USER: str = os.getenv("PLATFORM_ADMIN_USER", "admin")
    PLATFORM_ADMIN_PASSWORD: str = os.getenv("PLATFORM_ADMIN_PASSWORD", "admin123")
    PLATFORM_VIEWER_USER: str = os.getenv("PLATFORM_VIEWER_USER", "viewer")
    PLATFORM_VIEWER_PASSWORD: str = os.getenv("PLATFORM_VIEWER_PASSWORD", "admin123")

    # Airflow REST API integration
    AIRFLOW_BASE_URL: str = os.getenv("AIRFLOW_BASE_URL", "http://airflow-webserver:8080")
    AIRFLOW_ADMIN_USER: str = os.getenv("_AIRFLOW_WWW_USER_USERNAME", "sismo_admin")
    AIRFLOW_ADMIN_PASSWORD: str = os.getenv("_AIRFLOW_WWW_USER_PASSWORD", "admin123")

    # Groq AI Assistant
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    # CORS settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]


settings = Settings()
