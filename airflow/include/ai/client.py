"""AI Client integrating Groq API (openai/gpt-oss-120b) with deterministic fallback (Plan B)."""

import json
import logging
import os
import time
from typing import Dict, Any, Tuple
import httpx
from ai.schemas import CalculatedMetrics, ExecutiveReportOutput
from ai.prompts import SYSTEM_PROMPT_EXECUTIVE_REPORT, USER_PROMPT_TEMPLATE, PROMPT_VERSION
from ai.sanitizer import sanitize_place_text

logger = logging.getLogger("sismowatch.ai.client")


class GroqAIClient:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY", "")
        self.model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"
        self.timeout = 25.0

    def generate_executive_report(
        self, metrics: CalculatedMetrics
    ) -> Tuple[ExecutiveReportOutput, Dict[str, Any]]:
        """Generates narrative report using Groq LLM or falls back gracefully to Plan B."""
        start_time = time.time()

        # Build context JSON
        context = {
            "fecha_reporte": str(metrics.report_date),
            "total_sismos_24h": metrics.total_events,
            "magnitud_maxima_24h": metrics.max_magnitude,
            "magnitud_promedio_24h": metrics.avg_magnitude,
            "alertas_tsunami_24h": metrics.tsunami_events,
            "zona_mas_activa": metrics.most_active_region,
            "anomalias_detectadas": metrics.anomalies_count,
            "eventos_destacados": [
                {
                    "lugar": sanitize_place_text(e.get("place")),
                    "magnitud": float(e.get("mag") or 0.0),
                    "profundidad_km": float(e.get("depth_km") or 0.0),
                }
                for e in metrics.top_events[:5]
            ],
            "prompt_version": PROMPT_VERSION,
        }

        user_content = USER_PROMPT_TEMPLATE.format(
            context_json=json.dumps(context, indent=2, ensure_ascii=False),
            total_events=metrics.total_events,
            max_magnitude=metrics.max_magnitude,
            most_active_region=metrics.most_active_region,
            tsunami_events=metrics.tsunami_events,
            anomalies_count=metrics.anomalies_count,
        )

        # If no API key configured, invoke Plan B directly
        if not self.api_key or self.api_key.startswith("your_"):
            logger.warning("No valid GROQ_API_KEY found. Utilizing deterministic Plan B.")
            return self._plan_b_deterministic_report(metrics, start_time, "Sin API key")

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT_EXECUTIVE_REPORT},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(self.api_url, json=payload, headers=headers)

            latency_ms = int((time.time() - start_time) * 1000)

            if response.status_code == 200:
                result_json = response.json()
                raw_text = result_json["choices"][0]["message"]["content"]
                parsed_data = json.loads(raw_text)

                usage = result_json.get("usage", {})
                tokens_used = usage.get("total_tokens", 0)

                # Cost estimate (~$0.00015 per 1K tokens for open-weights on Groq)
                cost_estimate = round((tokens_used / 1000.0) * 0.00015, 6)

                report = ExecutiveReportOutput(
                    title=parsed_data.get(
                        "title", f"Reporte Sismológico Diario - {metrics.report_date}"
                    ),
                    executive_summary=parsed_data.get("executive_summary", ""),
                    activity_analysis=parsed_data.get("activity_analysis", ""),
                    tsunami_assessment=parsed_data.get("tsunami_assessment", ""),
                    anomaly_summary=parsed_data.get("anomaly_summary", ""),
                )

                meta = {
                    "model_used": self.model,
                    "tokens_used": tokens_used,
                    "latency_ms": latency_ms,
                    "cost_estimate_usd": cost_estimate,
                    "status": "SUCCESS",
                }
                return report, meta
            else:
                logger.error(
                    f"Groq API returned HTTP {response.status_code}: {response.text}"
                )
                return self._plan_b_deterministic_report(
                    metrics, start_time, f"Groq HTTP {response.status_code}"
                )

        except Exception as exc:
            logger.error(f"Error calling Groq API: {exc}. Activating Plan B fallback.")
            return self._plan_b_deterministic_report(
                metrics, start_time, f"Excepción: {str(exc)}"
            )

    def _plan_b_deterministic_report(
        self, metrics: CalculatedMetrics, start_time: float, reason: str
    ) -> Tuple[ExecutiveReportOutput, Dict[str, Any]]:
        """Deterministic fallback (Plan B) ensuring 100% pipeline reliability without LLM dependency."""
        latency_ms = int((time.time() - start_time) * 1000)

        tsunami_desc = (
            f"Se registraron {metrics.tsunami_events} alertas de tsunami oceánico que requieren vigilancia."
            if metrics.tsunami_events > 0
            else "No se registraron alertas de tsunami en las últimas 24 horas; los márgenes oceánicos permanecen en calma."
        )

        anomaly_desc = (
            f"Se identificaron {metrics.anomalies_count} eventos atípicos con Z-score elevado respecto a la línea base."
            if metrics.anomalies_count > 0
            else "La sismicidad se mantiene dentro de los intervalos estadísticos habituales."
        )

        report = ExecutiveReportOutput(
            title=f"Reporte Ejecutivo Sismológico - {metrics.report_date}",
            executive_summary=(
                f"Durante las últimas 24 horas se registraron {metrics.total_events} eventos sísmicos en la red global, "
                f"alcanzando una magnitud máxima de {metrics.max_magnitude:.1f} Mw y una media de {metrics.avg_magnitude:.2f} Mw. "
                f"La mayor concentración de actividad se detectó en la región de {metrics.most_active_region}."
            ),
            activity_analysis=(
                f"El patrón sismológico general exhibe una media estable ({metrics.avg_magnitude:.2f} Mw). "
                f"Los eventos principales se distribuyeron principalmente en zonas de subducción y fallas de desgarre activas."
            ),
            tsunami_assessment=tsunami_desc,
            anomaly_summary=anomaly_desc,
        )

        meta = {
            "model_used": "deterministic-fallback-v1",
            "tokens_used": 0,
            "latency_ms": latency_ms,
            "cost_estimate_usd": 0.0,
            "status": f"FALLBACK_PLAN_B ({reason})",
        }
        return report, meta
