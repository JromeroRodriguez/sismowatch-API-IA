"""FastAPI application entrypoint for SismoWatch.

Strictly consumes curated data from schema 'gold' using role 'sismo_readonly'.
Enforces JWT authentication, RBAC (viewer/admin), and restricted CORS.
"""

import logging
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from database import fetch_one
from routers import admin, auth, chat, earthquakes, pipeline, reports, stream

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
)
logger = logging.getLogger("sismowatch.api")

app = FastAPI(
    title="SismoWatch API",
    description="Backend oficial de consumo para la plataforma de monitoreo sísmico SismoWatch (Medallion Gold).",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS restriction
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(earthquakes.router)
app.include_router(reports.router)
app.include_router(chat.router)
app.include_router(pipeline.router)
app.include_router(pipeline.quality_router)
app.include_router(stream.router)
app.include_router(admin.router)


@app.get("/health", tags=["Salud del Sistema"], summary="Verificar estado de la API")
def health_check():
    """Endpoint de salud del backend y conectividad a PostgreSQL (schema gold)."""
    try:
        row = fetch_one("SELECT 1 AS ok;")
        db_healthy = row is not None and row.get("ok") == 1
    except Exception as exc:
        logger.error(f"Database health check failed: {exc}")
        db_healthy = False

    return {
        "status": "healthy" if db_healthy else "degraded",
        "database_connected": db_healthy,
        "schema_target": "gold",
        "role": settings.POSTGRES_USER,
    }
