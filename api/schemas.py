"""Pydantic schemas for request validation and response serialization."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# --- Authentication Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


class LoginRequest(BaseModel):
    username: str
    password: str


class User(BaseModel):
    username: str
    role: str


# --- Earthquake Schemas ---
class Earthquake(BaseModel):
    id: str
    place: Optional[str] = None
    time: datetime
    updated: Optional[datetime] = None
    latitude: float
    longitude: float
    depth_km: Optional[float] = None
    mag: Optional[float] = None
    mag_type: Optional[str] = None
    tsunami: Optional[int] = 0
    sig: Optional[int] = 0
    status: Optional[str] = None
    event_type: Optional[str] = "earthquake"
    url: Optional[str] = None
    ingested_at: Optional[datetime] = None


class PaginatedEarthquakes(BaseModel):
    items: List[Earthquake]
    total: int
    page: int
    page_size: int
    total_pages: int


# --- KPIs and Analytics Schemas ---
class KPIsResponse(BaseModel):
    total_events_24h: int
    max_magnitude_24h: Optional[float] = None
    avg_magnitude_24h: Optional[float] = None
    tsunami_alerts_24h: int
    latest_event_time: Optional[datetime] = None
    quality_score: Optional[float] = 100.0
    data_freshness_minutes: Optional[float] = None
    total_events_gold: int


class TimeSeriesPoint(BaseModel):
    time_bucket: str
    count: int
    max_mag: Optional[float] = None
    avg_mag: Optional[float] = None


# --- Pipeline & Quality Schemas ---
class PipelineStatusItem(BaseModel):
    dag_id: str
    state: Optional[str] = None
    last_run_id: Optional[str] = None
    last_success_at: Optional[datetime] = None
    last_failure_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class QualityMetricItem(BaseModel):
    run_id: str
    dag_id: str
    execution_timestamp: Optional[datetime] = None
    total_records: int
    rules_evaluated: int
    rules_passed: int
    rules_rejected: int
    quality_score: float
    freshness_minutes: Optional[float] = None
    status: str
    details: Optional[Dict[str, Any]] = None


class PipelineSummary(BaseModel):
    statuses: List[PipelineStatusItem]
    latest_quality: Optional[QualityMetricItem] = None


# --- Reports & Anomalies Schemas ---
class ReportItem(BaseModel):
    id: int
    report_date: str
    title: Optional[str] = None
    summary_narrative: str
    total_events: int
    max_magnitude: Optional[float] = None
    avg_magnitude: Optional[float] = None
    tsunami_events: int = 0
    most_active_region: Optional[str] = None
    model_used: Optional[str] = "openai/gpt-oss-120b"
    tokens_used: int = 0
    latency_ms: int = 0
    cost_estimate_usd: Optional[float] = 0.0
    generated_at: datetime


class AnomalyItem(BaseModel):
    id: int
    event_id: Optional[str] = None
    detection_date: datetime
    technique: str
    place: Optional[str] = None
    magnitude: Optional[float] = None
    depth_km: Optional[float] = None
    anomaly_score: Optional[float] = None
    explanation: str


# --- Admin Action Schemas ---
class BackfillRequest(BaseModel):
    days_back: int = Field(default=30, ge=1, le=90, description="Días hacia atrás a consultar")
    min_magnitude: float = Field(
        default=2.5, ge=0.0, le=10.0, description="Magnitud mínima para filtrar"
    )


class TriggerResponse(BaseModel):
    message: str
    dag_id: str
    run_id: Optional[str] = None
    status: str
