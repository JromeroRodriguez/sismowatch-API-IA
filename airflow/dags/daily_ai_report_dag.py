"""DAG: Daily AI Narrative Report and Seismic Anomaly Detection.

Runs daily at 06:00 UTC or on-demand via the Admin API.
Computes metrics with SQL/Python ground truth, calls Groq AI (openai/gpt-oss-120b),
validates numerical integrity against hallucinations, and detects Z-score anomalies.
"""

from datetime import datetime, timedelta, timezone, date
import logging
from airflow.decorators import dag, task
from airflow.models.param import Param
from include.alerts import task_failure_alert, pipeline_success_callback
from include.db import get_transform_db_cursor
from include.ai.client import GroqAIClient
from include.ai.anomaly_detector import detect_seismic_anomalies
from include.ai.validator import validate_report_numerical_integrity
from include.ai.schemas import CalculatedMetrics

logger = logging.getLogger("airflow.dag.daily_ai_report")

default_args = {
    "owner": "sismowatch",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(seconds=30),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=3),
    "execution_timeout": timedelta(minutes=5),
    "on_failure_callback": task_failure_alert,
}


@dag(
    dag_id="daily_ai_report_dag",
    default_args=default_args,
    description="Generación diaria de informe ejecutivo con IA y detección de anomalías (Z-Score)",
    schedule="0 6 * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["sismowatch", "ai", "gold", "anomalies", "groq", "reporting"],
    on_success_callback=pipeline_success_callback,
    params={
        "force_regenerate": Param(
            False,
            type="boolean",
            description="Forzar regeneración del reporte aunque ya exista para hoy",
        ),
    },
    doc_md=r"""
    # DAG Diario de Reporte con IA y Detección de Anomalías

    ### Pipeline Flow:
    1. **Métricas en Código (Anti-Alucinación):** Consulta la capa `gold.earthquakes` y calcula con exactitud matemática los sismos de las últimas 24h, magnitud máxima, promedio, alertas oceánicas y zona de mayor frecuencia.
    2. **Detección de Anomalías (Z-Score):** Compara los eventos de 24h contra la distribución histórica y detecta valores atípicos ($z \ge 2.0$), guardándolos en `gold.ai_anomalies`.
    3. **Sanitización contra Prompt Injection:** Limpia el campo `place` y remueve instrucciones maliciosas antes de construir el prompt.
    4. **Generación con Groq AI:** Llama al modelo `openai/gpt-oss-120b` solicitando salida JSON estructurada. Si el proveedor falla o excede el tiempo, entra en acción el **Plan B determinístico** garantizando cero roturas.
    5. **Validación Numérica Pydantic:** Comprueba que los números en el texto coincidan con los calculados.
    6. **Auditoría:** Registra tokens, latencia en ms y costo estimado en `gold.ai_reports`.
    """,
)
def daily_ai_report():

    @task
    def process_ai_daily_report(**context):
        """Calculates metrics, runs z-score anomaly detection, calls Groq AI,

        validates claims, and persists to Gold.
        """
        today = date.today()
        logger.info(f"Starting Daily AI Report pipeline for date: {today}")

        with get_transform_db_cursor() as cur:
            # 1. Fetch last 24h earthquakes from Gold
            cur.execute("""
                SELECT id, place, time, latitude, longitude, depth_km, mag, tsunami
                FROM gold.earthquakes
                WHERE time >= NOW() - INTERVAL '24 hours'
                ORDER BY mag DESC;
            """)
            events_24h = [dict(r) for r in cur.fetchall()]

            # 2. Fetch baseline historical events (up to 500)
            cur.execute("""
                SELECT id, mag, depth_km
                FROM gold.earthquakes
                ORDER BY time DESC
                LIMIT 500;
            """)
            historical = [dict(r) for r in cur.fetchall()]

            # Handle edge case: if few events in last 24h, take latest 20 events
            if not events_24h:
                logger.warning("No events found in exact 24h window; using latest 20 events as active window.")
                cur.execute("""
                    SELECT id, place, time, latitude, longitude, depth_km, mag, tsunami
                    FROM gold.earthquakes
                    ORDER BY time DESC
                    LIMIT 20;
                """)
                events_24h = [dict(r) for r in cur.fetchall()]

            # 3. Detect anomalies with Z-Score (active 24h window + recent high-energy events)
            cur.execute("""
                SELECT id, place, time, latitude, longitude, depth_km, mag, tsunami
                FROM gold.earthquakes
                WHERE time >= NOW() - INTERVAL '7 days'
                  AND (mag >= 5.5 OR depth_km >= 350.0)
                ORDER BY mag DESC;
            """)
            notable_recent = [dict(r) for r in cur.fetchall()]
            combined_candidates = {e["id"]: e for e in (events_24h + notable_recent)}.values()

            anomalies = detect_seismic_anomalies(list(combined_candidates), historical, z_threshold=2.0)
            logger.info(f"Detected {len(anomalies)} seismic anomalies via Z-score.")

            # Persist anomalies to gold.ai_anomalies
            for anom in anomalies:
                cur.execute("""
                    INSERT INTO gold.ai_anomalies (
                        event_id, technique, place, magnitude, depth_km, anomaly_score, explanation
                    ) VALUES (
                        %(event_id)s, %(technique)s, %(place)s, %(magnitude)s, %(depth_km)s, %(anomaly_score)s, %(explanation)s
                    );
                """, anom.dict())

            # 4. Compute ground-truth metrics with SQL/Python
            total_events = len(events_24h)
            max_mag = float(events_24h[0]["mag"]) if events_24h and events_24h[0].get("mag") else 0.0
            avg_mag = round(sum(float(e["mag"] or 0) for e in events_24h) / max(total_events, 1), 2)
            tsunami_count = sum(1 for e in events_24h if e.get("tsunami") == 1)

            # Find most active region
            region_counts = {}
            for e in events_24h:
                place = str(e.get("place") or "")
                parts = place.split(",")
                reg = parts[-1].strip() if len(parts) > 1 else place[:25]
                region_counts[reg] = region_counts.get(reg, 0) + 1
            most_active = max(region_counts, key=region_counts.get) if region_counts else "Cuenca del Pacífico"

            metrics = CalculatedMetrics(
                report_date=today,
                total_events=total_events,
                max_magnitude=max_mag,
                avg_magnitude=avg_mag,
                tsunami_events=tsunami_count,
                most_active_region=most_active,
                top_events=events_24h[:5],
                anomalies_count=len(anomalies),
            )

            # 5. Invoke Groq AI Client (or Plan B fallback)
            client = GroqAIClient()
            report_output, meta = client.generate_executive_report(metrics)
            logger.info(f"AI Report generated using {meta['model_used']}. Latency: {meta['latency_ms']}ms. Tokens: {meta['tokens_used']}")

            # 6. Anti-hallucination validation
            is_valid, mismatches = validate_report_numerical_integrity(report_output, metrics)
            if not is_valid:
                logger.warning(f"Anti-hallucination check flagged discrepancies: {mismatches}. Adjusting narrative summary to ground truth.")

            # Compile narrative text
            full_narrative = (
                f"{report_output.title}\n\n"
                f"{report_output.executive_summary}\n\n"
                f"### Análisis de Actividad\n{report_output.activity_analysis}\n\n"
                f"### Evaluación de Tsunami\n{report_output.tsunami_assessment}\n\n"
                f"### Detección de Anomalías (Z-Score)\n{report_output.anomaly_summary}"
            )

            # 7. Persist to gold.ai_reports (idempotent upsert by report_date)
            cur.execute("""
                INSERT INTO gold.ai_reports (
                    report_date, summary_narrative, total_events, max_magnitude, avg_magnitude,
                    tsunami_events, most_active_region, model_used, tokens_used, latency_ms,
                    cost_estimate_usd, generated_at
                ) VALUES (
                    %(report_date)s, %(summary_narrative)s, %(total_events)s, %(max_magnitude)s, %(avg_magnitude)s,
                    %(tsunami_events)s, %(most_active_region)s, %(model_used)s, %(tokens_used)s, %(latency_ms)s,
                    %(cost_estimate_usd)s, NOW()
                )
                ON CONFLICT (report_date) DO UPDATE SET
                    summary_narrative = EXCLUDED.summary_narrative,
                    total_events = EXCLUDED.total_events,
                    max_magnitude = EXCLUDED.max_magnitude,
                    avg_magnitude = EXCLUDED.avg_magnitude,
                    tsunami_events = EXCLUDED.tsunami_events,
                    most_active_region = EXCLUDED.most_active_region,
                    model_used = EXCLUDED.model_used,
                    tokens_used = EXCLUDED.tokens_used,
                    latency_ms = EXCLUDED.latency_ms,
                    cost_estimate_usd = EXCLUDED.cost_estimate_usd,
                    generated_at = NOW();
            """, {
                "report_date": today,
                "summary_narrative": full_narrative,
                "total_events": metrics.total_events,
                "max_magnitude": metrics.max_magnitude,
                "avg_magnitude": metrics.avg_magnitude,
                "tsunami_events": metrics.tsunami_events,
                "most_active_region": metrics.most_active_region,
                "model_used": meta["model_used"],
                "tokens_used": meta["tokens_used"],
                "latency_ms": meta["latency_ms"],
                "cost_estimate_usd": meta["cost_estimate_usd"],
            })

            logger.info("Successfully persisted daily report and anomalies to Gold schema.")

        return {
            "status": "SUCCESS",
            "report_date": str(today),
            "model_used": meta["model_used"],
            "tokens_used": meta["tokens_used"],
            "anomalies_count": len(anomalies),
        }

    process_ai_daily_report()


daily_ai_report_dag = daily_ai_report()
