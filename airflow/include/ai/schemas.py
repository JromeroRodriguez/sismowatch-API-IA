"""Pydantic schemas for AI output validation and metrics."""

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class CalculatedMetrics(BaseModel):
    report_date: date
    total_events: int
    max_magnitude: float
    avg_magnitude: float
    tsunami_events: int
    most_active_region: str
    top_events: List[dict]
    anomalies_count: int


class ExecutiveReportOutput(BaseModel):
    title: str = Field(description="Título formal del reporte sismológico")
    executive_summary: str = Field(description="Resumen ejecutivo del periodo")
    activity_analysis: str = Field(description="Análisis técnico de fallas y actividad")
    tsunami_assessment: str = Field(description="Evaluación sobre riesgo de tsunami")
    anomaly_summary: str = Field(description="Resumen de anomalías estadísticas detectadas")


class AnomalyDetail(BaseModel):
    event_id: str
    place: str
    magnitude: float
    depth_km: float
    technique: str = "z-score"
    anomaly_score: float
    explanation: str
