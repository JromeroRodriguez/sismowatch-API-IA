"""Conversational Seismic Chatbot router with Real-Time Ground-Truth Data Retrieval."""

import re
import time
from typing import Any, Dict, List
import httpx
from fastapi import APIRouter, Depends
from auth import require_viewer_or_admin
from config import settings
from database import fetch_all, fetch_one
from schemas import ChatRequest, ChatResponse, User

router = APIRouter(prefix="/api/chat", tags=["AI Chatbot"])

# OWASP LLM01 Sanitization regexes
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions",
    r"system\s*override",
    r"you\s+are\s+now\s+(a\s+)?hacker",
    r"dan\s+mode",
    r"jailbreak",
    r"forget\s+everything",
    r"drop\s+table",
    r"delete\s+from",
]


def sanitize_message(text: str) -> str:
    """Sanitize user input against prompt injection and command strings."""
    cleaned = text.strip()
    for pattern in INJECTION_PATTERNS:
        cleaned = re.sub(pattern, "[BLOCKED_INSTRUCTION]", cleaned, flags=re.IGNORECASE)
    # Remove control characters
    cleaned = "".join(ch for ch in cleaned if ch.isprintable() or ch in "\n\t")
    return cleaned[:1000]


def get_live_seismic_context() -> Dict[str, Any]:
    """Retrieves real-time ground-truth facts from PostgreSQL gold schema."""
    # 1. 24h & general KPIs
    kpi_query = """
        SELECT
            COUNT(*) AS total_24h,
            COALESCE(MAX(mag), 0.0) AS max_mag_24h,
            ROUND(COALESCE(AVG(mag), 0.0)::numeric, 2) AS avg_mag_24h,
            COALESCE(SUM(CASE WHEN tsunami = 1 THEN 1 ELSE 0 END), 0) AS tsunami_alerts_24h,
            (SELECT place FROM gold.earthquakes WHERE time >= NOW() - INTERVAL '24 hours' ORDER BY mag DESC LIMIT 1) AS strongest_place_24h
        FROM gold.earthquakes
        WHERE time >= NOW() - INTERVAL '24 hours';
    """
    kpis = fetch_one(kpi_query) or {}

    # 2. Top 5 places with HIGHEST activity in the last 7 days
    top_query = """
        SELECT place, COUNT(*) AS count, MAX(mag) AS max_mag, ROUND(AVG(mag)::numeric, 2) AS avg_mag
        FROM gold.earthquakes
        WHERE time >= NOW() - INTERVAL '7 days' AND place IS NOT NULL
        GROUP BY place
        ORDER BY count DESC
        LIMIT 5;
    """
    top_places = fetch_all(top_query)

    # 3. Places with LOWEST activity / single isolated events in last 7 days
    lowest_query = """
        SELECT place, COUNT(*) AS count, MIN(mag) AS min_mag, MAX(mag) AS max_mag
        FROM gold.earthquakes
        WHERE time >= NOW() - INTERVAL '7 days' AND place IS NOT NULL
        GROUP BY place
        ORDER BY count ASC, max_mag ASC
        LIMIT 5;
    """
    lowest_places = fetch_all(lowest_query)

    # 4. Recent statistical anomalies from gold.ai_anomalies
    anomalies_query = """
        SELECT place, magnitude, depth_km, anomaly_score, explanation
        FROM gold.ai_anomalies
        ORDER BY detection_date DESC
        LIMIT 4;
    """
    anomalies = fetch_all(anomalies_query)

    # 5. Top 3 strongest recent earthquakes
    strongest_query = """
        SELECT place, mag, depth_km, TO_CHAR(time, 'YYYY-MM-DD HH24:MI UTC') AS event_time
        FROM gold.earthquakes
        ORDER BY mag DESC, time DESC
        LIMIT 3;
    """
    strongest_events = fetch_all(strongest_query)

    return {
        "kpis": kpis,
        "top_places": top_places,
        "lowest_places": lowest_places,
        "anomalies": anomalies,
        "strongest_events": strongest_events,
    }


def build_system_prompt(ctx: Dict[str, Any]) -> str:
    k = ctx.get("kpis", {})
    top_str = "\n".join(
        [f"  - {row['place']}: {row['count']} sismos (Magnitud máx: {row['max_mag']})" for row in ctx.get("top_places", [])]
    ) or "  - No hay datos suficientes"

    low_str = "\n".join(
        [f"  - {row['place']}: {row['count']} sismo(s) registrado(s) (Magnitud: {row['min_mag']})" for row in ctx.get("lowest_places", [])]
    ) or "  - No hay datos suficientes"

    strongest_str = "\n".join(
        [f"  - {row['place']}: Magnitud {row['mag']}, Profundidad: {row['depth_km']}km ({row['event_time']})" for row in ctx.get("strongest_events", [])]
    ) or "  - No hay sismos destacados"

    anom_str = "\n".join(
        [f"  - {row['place']}: Mag {row['magnitude']}, {row['explanation']}" for row in ctx.get("anomalies", [])]
    ) or "  - No se registran anomalías estadísticas recientes"

    return f"""Eres 'SismoBot', el asistente sismológico inteligente en tiempo real de SismoWatch.
Tu labor es responder consultas de usuarios analizando con rigor científico y precisión matemática la base de datos oficial del USGS (capa Gold de PostgreSQL).

DATOS EN TIEMPO REAL VERIFICADOS (CAPA GOLD):
* Total de sismos en las últimas 24 horas: {k.get('total_24h', 0)}
* Magnitud máxima en 24h: {k.get('max_mag_24h', 0.0)} ({k.get('strongest_place_24h', 'N/A')})
* Promedio de magnitud en 24h: {k.get('avg_mag_24h', 0.0)} Mw
* Alertas de Tsunami activas (24h): {k.get('tsunami_alerts_24h', 0)}

ZONAS CON MAYOR ACTIVIDAD SÍSMICA (Últimos 7 días):
{top_str}

ZONAS CON MENOR ACTIVIDAD SÍSMICA / EVENTOS AISLADOS (Últimos 7 días):
{low_str}

SISMOS MÁS FUERTES REGISTRADOS:
{strongest_str}

ANOMALÍAS ESTADÍSTICAS DETECTADAS (Z-SCORE >= 2.0):
{anom_str}

INSTRUCCIONES CLAVE DE RESPUESTA:
1. Responde SIEMPRE en Español, con tono profesional, claro, analítico y estructurado con Markdown (usa viñetas, negritas, encabezados y tablas cuando sea útil). No utilices emojis. Desarrolla y concluye siempre tus ideas de manera completa sin truncar oraciones ni párrafos.
2. Si te preguntan '¿dónde hay más sismos?', lista con exactitud las zonas con mayor actividad y explica brevemente la concentración sísmica.
3. Si te preguntan '¿cuál es el lugar de menor actividad?', cita los lugares con menor número de registros aislados en el monitoreo.
4. Si te piden 'generar un reporte', estructura tu respuesta con:
   - 📊 **Resumen Ejecutivo**
   - 📍 **Zonas Calientes vs. Zonas Calmas**
   - ⚠️ **Eventos Relevantes y Alertas**
   - 🛡️ **Conclusiones y Monitoreo Preventivo**
5. Si preguntan por anomalías, explica qué eventos rompieron el patrón estadístico Z-Score.
6. NUNCA inventes números fuera de los datos reales provistos. Si no posees un dato exacto, dilo transparentemente.
"""


def generate_fallback_response(user_msg: str, ctx: Dict[str, Any]) -> str:
    """Deterministic fallback if Groq API is unavailable or rate-limited."""
    k = ctx.get("kpis", {})
    top = ctx.get("top_places", [])
    low = ctx.get("lowest_places", [])
    anom = ctx.get("anomalies", [])

    lower = user_msg.lower()

    if "reporte" in lower or "resumen" in lower:
        return f"""### 📊 Reporte Sísmico Ejecutivo (Plan B Determinista)

* **Actividad Global 24h:** Se han registrado **{k.get('total_24h', 0)} eventos sísmicos** en la capa Gold curada.
* **Sismo Más Significativo:** Magnitud **{k.get('max_mag_24h', 0.0)}** en *{k.get('strongest_place_24h', 'Región monitoreada')}*.
* **Magnitud Promedio:** **{k.get('avg_mag_24h', 0.0)} Mw**.
* **Alertas Oceánicas:** **{k.get('tsunami_alerts_24h', 0)} alertas de tsunami** generadas.

#### 📍 Zonas con Mayor Frecuencia (7 días):
{chr(10).join([f"- **{row['place']}**: {row['count']} sismos (Máx: {row['max_mag']} Mw)" for row in top[:3]])}

*Nota: Reporte generado en modo de contingencia directa con los datos de PostgreSQL Gold.*"""

    elif "más" in lower or "mas" in lower or "mayor" in lower or "frecuente" in lower:
        return f"""### 📍 Zonas con Mayor Actividad Sísmica Reciente

Según el registro de los últimos 7 días en la capa Gold de SismoWatch, las zonas con mayor concentración de eventos son:

{chr(10).join([f"1. **{row['place']}** con **{row['count']} sismos** (Magnitud máxima: {row['max_mag']} Mw, Promedio: {row['avg_mag']} Mw)" for row in top])}

Estas áreas representan los epicentros de mayor recurrencia tectónica actualmente monitoreados."""

    elif "menor" in lower or "menos" in lower or "calma" in lower or "tranquil" in lower:
        return f"""### 📉 Zonas con Menor Actividad Sísmica Registrada

En el monitoreo de los últimos 7 días, las siguientes zonas reportan la menor cantidad de eventos sísmicos (eventos aislados o de baja recurrencia):

{chr(10).join([f"- **{row['place']}**: solo **{row['count']} sismo aislado** (Magnitud: {row['min_mag']} Mw)" for row in low])}

Estas ubicaciones presentan actualmente un estado de relativa calma o baja densidad sísmica dentro del catálogo."""

    elif "anomal" in lower or "atipic" in lower:
        anom_list = chr(10).join([f"- **{row['place']}**: Mag {row['magnitude']}, Prof: {row.get('depth_km', 'N/A')}km — *{row['explanation']}*" for row in anom]) if anom else "No se han registrado anomalías Z-Score en las últimas horas."
        return f"""### 🔍 Anomalías Estadísticas Detectadas (Z-Score $\ge$ 2.0)

{anom_list}

Estos eventos superan en al menos 2 desviaciones estándar el promedio histórico de su región."""

    else:
        return f"""### 🌍 Estado Sísmico Global en Tiempo Real

* **Total sismos 24h:** **{k.get('total_24h', 0)}** eventos validados.
* **Sismo Mayor:** **{k.get('max_mag_24h', 0.0)} Mw** ({k.get('strongest_place_24h', 'N/A')}).
* **Zona Más Activa:** **{top[0]['place'] if top else 'N/A'}** ({top[0]['count'] if top else 0} sismos).
* **Zona de Menor Registro:** **{low[0]['place'] if low else 'N/A'}** (1 sismo).

*Puedes consultarme: "¿Dónde hay más sismos?", "¿Cuál es el lugar de menor actividad?" o "Genérame un reporte".*"""


@router.post("", response_model=ChatResponse, summary="Chatbot interactivo con datos sísmicos en vivo")
async def chat_interaction(
    request: ChatRequest,
    current_user: User = Depends(require_viewer_or_admin),
):
    """Procesa consultas en lenguaje natural del usuario, inyecta métricas en vivo

    desde PostgreSQL Gold y genera una respuesta con Groq AI.
    """
    start_time = time.time()
    clean_user_message = sanitize_message(request.message)

    # 1. Extraer hechos en tiempo real de PostgreSQL (rol: sismo_readonly)
    ctx = get_live_seismic_context()
    system_prompt = build_system_prompt(ctx)

    # 2. Construir historial de mensajes
    messages = [{"role": "system", "content": system_prompt}]
    for h in (request.history or [])[-4:]:  # Últimos 4 mensajes de contexto
        messages.append({"role": h.role, "content": sanitize_message(h.content)})
    messages.append({"role": "user", "content": clean_user_message})

    # 3. Llamar a Groq Cloud
    groq_api_key = settings.GROQ_API_KEY
    groq_model = settings.GROQ_MODEL or "openai/gpt-oss-120b"
    reply_text = ""
    used_model = groq_model

    if groq_api_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": groq_model,
                        "messages": messages,
                        "temperature": 0.2,
                        "max_tokens": 2500,
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    choices = data.get("choices", [])
                    if choices:
                        reply_text = choices[0].get("message", {}).get("content", "").strip()
                else:
                    reply_text = generate_fallback_response(clean_user_message, ctx)
                    used_model = f"{groq_model} (Fallback HTTP {res.status_code})"
        except Exception:
            reply_text = generate_fallback_response(clean_user_message, ctx)
            used_model = f"{groq_model} (Fallback Determinista)"
    else:
        reply_text = generate_fallback_response(clean_user_message, ctx)
        used_model = "Deterministic Plan B Engine"

    latency_ms = int((time.time() - start_time) * 1000)

    suggested_questions = [
        "¿Dónde hay más sismos?",
        "¿Cuál es el lugar con menor actividad?",
        "Genérame un reporte ejecutivo de las últimas 24h",
        "¿Cuáles son las anomalías estadísticas recientes?",
    ]

    return ChatResponse(
        reply=reply_text,
        suggested_questions=suggested_questions,
        model=used_model,
        latency_ms=latency_ms,
        context_used={
            "total_24h": ctx.get("kpis", {}).get("total_24h"),
            "max_mag_24h": ctx.get("kpis", {}).get("max_mag_24h"),
            "top_place": ctx.get("top_places", [{}])[0].get("place") if ctx.get("top_places") else None,
        },
    )
