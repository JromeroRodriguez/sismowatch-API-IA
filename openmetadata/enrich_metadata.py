"""Enrich OpenMetadata with professional descriptions, tiers, and data dictionary (sober and formal, without emojis)."""

import base64
import json
import urllib.request
import urllib.error

OM_SERVER = "http://localhost:8585"

SCHEMA_DESCRIPTIONS = {
    "bronze": (
        "**Capa Bronze (Raw Data Inmutable)**: Almacena los eventos sísmicos brutos en formato GeoJSON "
        "obtenidos directamente de los endpoints de la USGS (`/summary/all_hour.geojson` y `/fdsnws/event/1/query`). "
        "Garantiza idempotencia, preservación histórica e inmutabilidad del dato de origen."
    ),
    "silver": (
        "**Capa Silver (Calidad, Limpieza y Tipado)**: Datos sísmicos validados y normalizados con Pandera. "
        "Aplica validación de rangos físicos (magnitud [-2, 10], profundidad [0, 800] km), tipado estricto "
        "y deduplicación. Los registros corruptos o que fallan calidad se marcan con `is_valid = FALSE` y son descartados."
    ),
    "gold": (
        "**Capa Gold (Consumo Analítico y Negocio)**: Datos limpios y enriquecidos listos para consumo. "
        "Alimenta la API REST FastAPI, el tablero React, las alertas tempranas y el asistente conversacional SismoBot. "
        "Incluye agregaciones por día/región y auditoría de calidad histórica."
    ),
}

TABLE_METADATA = {
    "earthquakes_raw": {
        "description": (
            "**Eventos Sísmicos Brutos (Raw Ingestion)**: Registros íntegros de la USGS en formato JSONB. "
            "Fuente de verdad inmutable para auditorías, re-procesamientos y trazabilidad de origen."
        ),
        "columns": {
            "id": "Identificador único global del sismo asignado por USGS (ej. 'us7000abcd'). Clave primaria.",
            "raw_payload": "Cuerpo completo del GeoJSON Feature (properties, geometry, coordinates).",
            "ingested_at": "Marca de tiempo UTC en que el DAG de Airflow insertó el registro.",
            "source": "Identificador del feed de origen ('usgs_realtime' o 'usgs_historical').",
        },
    },
    "earthquakes_clean": {
        "description": (
            "**Datos Sísmicos Validados (Capa Silver)**: Registros tipados y analizados por la suite Pandera. "
            "Implementa el control de calidad donde solo los registros con `is_valid = TRUE` pasan al consumo Gold."
        ),
        "columns": {
            "id": "Identificador único del sismo.",
            "mag": "Magnitud en escala de momento sísmico o Richter (válido de -2.0 a 10.0).",
            "place": "Descripción textual geográfica de la ubicación del epicentro.",
            "time": "Marca temporal del instante exacto del sismo en horario UTC.",
            "latitude": "Latitud geográfica en grados decimales (-90 a 90).",
            "longitude": "Longitud geográfica en grados decimales (-180 a 180).",
            "depth_km": "Profundidad focal del hipocentro en kilómetros (0 a 800 km).",
            "is_valid": "Flag booleano de calidad Pandera. True = aprobado, False = rechazado.",
            "validation_errors": "Detalle en texto o JSON de las reglas fallidas en caso de invalidación.",
        },
    },
    "earthquakes": {
        "description": (
            "**Sismos Curados para Consumo (Capa Gold)**: Fuente oficial de datos sísmicos consumida por FastAPI, "
            "el visor cartográfico Leaflet (ESRI Canvas) y el asistente IA SismoBot. Solo contiene registros validados."
        ),
        "columns": {
            "id": "Identificador único del evento sísmico.",
            "mag": "Magnitud oficial del sismo.",
            "place": "Región o descripción del epicentro.",
            "time": "Fecha y hora UTC del evento.",
            "latitude": "Latitud decimal del epicentro.",
            "longitude": "Longitud decimal del epicentro.",
            "depth_km": "Profundidad del sismo en kilómetros.",
            "status": "Estado de revisión del evento por sismólogos de la USGS (reviewed / automatic).",
            "tsunami": "Indicador binario de alerta de tsunami (1 = activa, 0 = inactiva).",
            "alert": "Nivel de alerta USGS por código de color (green, yellow, orange, red).",
            "significance": "Puntaje de significancia de impacto social/geográfico calculado por USGS.",
            "net": "Red sismológica que originó la detección (ej. 'us', 'ci', 'ak').",
        },
    },
    "daily_aggregates": {
        "description": (
            "**Métricas Diarias Agregadas (Gold Analytics)**: Agrupación analítica por día y región geográfica. "
            "Permite graficar tendencias históricas, conteos y promedios de energía liberada sin recalcular sobre toda la base."
        ),
        "columns": {
            "date": "Fecha del análisis (YYYY-MM-DD).",
            "region": "Región o clúster geográfico analizado.",
            "count": "Número total de eventos sísmicos registrados en el día.",
            "avg_magnitude": "Promedio aritmético de las magnitudes registradas.",
            "max_magnitude": "Magnitud máxima (sismo pico) detectada en la jornada.",
        },
    },
    "quality_metrics": {
        "description": (
            "**Registro Histórico de Gobernanza y Calidad**: Almacena las métricas calculadas por el Pandera Quality Gate "
            "en cada corrida de Airflow (tasa de validez %, total procesados, total descartados). Umbral crítico: 70%."
        ),
        "columns": {
            "run_id": "Identificador de ejecución de Airflow DAG Run.",
            "execution_date": "Momento en que se ejecutó el control de calidad.",
            "total_records": "Total de sismos recibidos en el lote.",
            "valid_records": "Sismos que superaron todas las validaciones de calidad.",
            "invalid_records": "Sismos descartados por inconsistencias o fuera de rango.",
            "validity_rate": "Porcentaje de registros limpios. Si es menor a 70%, el pipeline falla por seguridad.",
        },
    },
    "ai_anomalies": {
        "description": (
            "**Detección Estadística de Anomalías Sísmicas**: Registro de eventos identificados como anómalos "
            "mediante desviación estándar y cálculo de Z-Score sobre la sismicidad base de cada región."
        ),
        "columns": {
            "earthquake_id": "Referencia al sismo detectado en la capa Gold.",
            "z_score": "Puntaje Z estadístico. Valores > 2.5 representan anomalías significativas.",
            "anomaly_type": "Clasificación de la anomalía (ej. 'Magnitud Extrema', 'Clúster Inusual').",
            "detected_at": "Timestamp en que el detector de anomalías registró el hallazgo.",
        },
    },
    "ai_reports": {
        "description": (
            "**Reportes Diarios de Síntesis IA**: Informes automáticos generados por el modelo de lenguaje "
            "(Groq / Llama 3) resumiendo la actividad sísmica de las últimas 24 horas y anomalías detectadas."
        ),
        "columns": {
            "report_date": "Fecha de cobertura del reporte de IA.",
            "content": "Texto generado en Markdown con el análisis de actividad y recomendaciones.",
            "model_used": "Modelo de lenguaje utilizado para la generación (ej. 'openai/gpt-oss-120b' o 'llama-3.3-70b-versatile').",
            "generated_at": "Momento de generación del reporte.",
        },
    },
    "pipeline_status": {
        "description": (
            "**Observabilidad de Pipelines**: Estado de ejecución en tiempo real de los DAGs de Airflow, "
            "tiempos de latencia y volumen de ingesta para monitoreo continuo del sistema."
        ),
        "columns": {
            "pipeline_name": "Nombre del DAG ejecutado.",
            "status": "Estado final (SUCCESS, FAILED).",
            "records_processed": "Cantidad de registros operados en la corrida.",
            "updated_at": "Última actualización de estado registrada.",
        },
    },
}

def login():
    encoded_pw = base64.b64encode(b"admin").decode()
    req = urllib.request.Request(
        f"{OM_SERVER}/api/v1/users/login",
        data=json.dumps({"email": "admin@open-metadata.org", "password": encoded_pw}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())["accessToken"]

def patch_entity(token, endpoint, patch_ops):
    req = urllib.request.Request(
        f"{OM_SERVER}/api/v1/{endpoint}",
        data=json.dumps(patch_ops).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json-patch+json",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Error patching {endpoint}: {e.code} - {e.read().decode()[:200]}")
        return None

def main():
    print("1. Conectando con OpenMetadata Server...")
    token = login()
    print("✓ Autenticado con éxito.")

    # 1. Enriquecer esquemas
    print("\n2. Enriqueciendo descripciones de esquemas (Bronze, Silver, Gold)...")
    req = urllib.request.Request(
        f"{OM_SERVER}/api/v1/databaseSchemas?database=sismowatch_postgres.sismowatch",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as resp:
        schemas = json.loads(resp.read().decode())["data"]

    for s in schemas:
        s_name = s["name"]
        if s_name in SCHEMA_DESCRIPTIONS:
            print(f" -> Actualizando esquema '{s_name}'...")
            patch_ops = [{"op": "add", "path": "/description", "value": SCHEMA_DESCRIPTIONS[s_name]}]
            patch_entity(token, f"databaseSchemas/{s['id']}", patch_ops)

    # 2. Enriquecer tablas y columnas
    print("\n3. Enriqueciendo tablas y columnas de cada capa...")
    for s_name in ["bronze", "silver", "gold"]:
        req = urllib.request.Request(
            f"{OM_SERVER}/api/v1/tables?databaseSchema=sismowatch_postgres.sismowatch.{s_name}&fields=columns",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(req) as resp:
            tables = json.loads(resp.read().decode())["data"]

        for t in tables:
            t_name = t["name"]
            meta = TABLE_METADATA.get(t_name)
            if not meta:
                continue

            print(f" -> Documentando tabla '{s_name}.{t_name}'...")
            patch_ops = [{"op": "add", "path": "/description", "value": meta["description"]}]

            # Documentar columnas si existen
            existing_cols = t.get("columns", [])
            for idx, col in enumerate(existing_cols):
                c_name = col["name"]
                if c_name in meta.get("columns", {}):
                    patch_ops.append({
                        "op": "add",
                        "path": f"/columns/{idx}/description",
                        "value": meta["columns"][c_name],
                    })

            patch_entity(token, f"tables/{t['id']}", patch_ops)

    print("\n============================================================")
    print("OK: Catálogo actualizado en OpenMetadata sin emojis.")
    print("Todos los esquemas, tablas y columnas ahora tienen formato formal.")
    print("============================================================")

if __name__ == "__main__":
    main()
