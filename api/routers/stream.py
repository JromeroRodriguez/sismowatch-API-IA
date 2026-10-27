"""Server-Sent Events (SSE) real-time stream router."""

import asyncio
import json
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, status
from jose import JWTError, jwt
from sse_starlette.sse import EventSourceResponse
from config import settings
from database import fetch_all, fetch_one
from schemas import User

logger = logging.getLogger("sismowatch.api.stream")

router = APIRouter(prefix="/api", tags=["Tiempo Real (SSE)"])


def authenticate_stream_token(token: Optional[str]) -> User:
    """Validate JWT token passed as query param (for EventSource) or return 401."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no proporcionado para la conexión en tiempo real",
        )
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        username = payload.get("sub")
        role = payload.get("role")
        if not username or not role:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado",
            )
        return User(username=username, role=role)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )


@router.get("/stream", summary="Transmisión en tiempo real de eventos sísmicos (SSE)")
async def event_stream(
    request: Request,
    token: Optional[str] = Query(None, description="JWT token para autenticación SSE"),
):
    """Canal Server-Sent Events (SSE) para actualización en tiempo real en el frontend.

    Envía eventos cada 5 segundos si hay nuevos datos y un heartbeat continuo.
    """
    # 1. Authenticate user from header or query param
    auth_header = request.headers.get("Authorization")
    jwt_token = token
    if auth_header and auth_header.startswith("Bearer "):
        jwt_token = auth_header.replace("Bearer ", "").strip()

    authenticate_stream_token(jwt_token)

    async def event_generator():
        last_seen_id = None
        while True:
            # Check client disconnection
            if await request.is_disconnected():
                logger.info("SSE client disconnected")
                break

            try:
                # Fetch newest event from Gold
                latest_sql = """
                    SELECT id, place, time, latitude, longitude, mag, depth_km, tsunami
                    FROM gold.earthquakes
                    ORDER BY time DESC
                    LIMIT 1;
                """
                latest = fetch_one(latest_sql)

                if latest and latest.get("id") != last_seen_id:
                    last_seen_id = latest.get("id")
                    data_payload = {
                        "type": "new_earthquake",
                        "event": {
                            "id": str(latest["id"]),
                            "place": latest["place"],
                            "time": latest["time"].isoformat() if latest["time"] else None,
                            "latitude": float(latest["latitude"]) if latest["latitude"] is not None else None,
                            "longitude": float(latest["longitude"]) if latest["longitude"] is not None else None,
                            "mag": float(latest["mag"]) if latest["mag"] is not None else None,
                            "depth_km": float(latest["depth_km"]) if latest["depth_km"] is not None else None,
                            "tsunami": int(latest["tsunami"] or 0),
                        },
                    }
                    yield {
                        "event": "earthquake",
                        "data": json.dumps(data_payload, default=str),
                    }
                else:
                    # Heartbeat keepalive ping
                    yield {
                        "event": "ping",
                        "data": json.dumps({"timestamp": asyncio.get_event_loop().time()}),
                    }

            except Exception as e:
                logger.error(f"Error in SSE stream loop: {e}")
                yield {
                    "event": "error",
                    "data": json.dumps({"error": "Temporarily unable to fetch update"}),
                }

            # Wait 5 seconds before next polling tick
            await asyncio.sleep(5)

    return EventSourceResponse(event_generator())
