# SismoWatch 🌍⚡

> **Plataforma de Monitoreo Sísmico en Tiempo Real, Control Automatizado de Calidad e Inteligencia Diaria con IA**  
> *Prueba de Desempeño Técnico - Ruta de IA y Automatización*

![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16_Medallion-blue?logo=postgresql)
![Apache Airflow 2.9.2](https://img.shields.io/badge/Apache_Airflow-2.9.2-teal?logo=apacheairflow)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?logo=fastapi)
![React 18](https://img.shields.io/badge/React-18_TypeScript-cyan?logo=react)
![Pandera](https://img.shields.io/badge/Pandera-Data_Quality-orange)
![Groq AI](https://img.shields.io/badge/Groq_AI-openai%2Fgpt--oss--120b-purple)
![OpenMetadata](https://img.shields.io/badge/OpenMetadata-Data_Governance-red)
![Gitleaks](https://img.shields.io/badge/Gitleaks-0_leaks-brightgreen)
![Bandit](https://img.shields.io/badge/Bandit-0_vulnerabilities-brightgreen)

---

## 1. Descripción del Proyecto

**SismoWatch** es un ecosistema punta a punta diseñado para ingestar, limpiar, validar, analizar y visualizar en tiempo real la actividad sísmica global reportada por el catálogo público del **USGS (United States Geological Survey)**.

### Características Principales:
* **Arquitectura Medallion en PostgreSQL:** Schemas `bronze` (crudo inmutable), `silver` (limpio, tipado y flag `is_valid`) y `gold` (curado de consumo analítico).
* **Calidad de Datos con Pandera:** Quality gate bloqueante con score mínimo del 70%. Los datos con anomalías o fuera de límites se descartan en Silver y **nunca llegan a Gold**.
* **Orquestación Reactiva (Event-Driven):** DAGs de Airflow enlazados mediante **Datasets/Assets** (`sismowatch://bronze/earthquakes_raw`), eliminando encadenamientos rígidos.
* **Inteligencia Artificial con Groq (`openai/gpt-oss-120b`):** Reporte ejecutivo diario automatizado, cálculo de anomalías por **Z-Score** ($z \ge 2.0$), sanitización contra Prompt Injection (OWASP LLM01), barandilla anti-alucinación y fallback determinista (Plan B).
* **API Segura y RBAC:** FastAPI con JWT HS256, roles `viewer` y `admin`, conectada a la base de datos exclusivamente mediante el rol de base de datos con mínimo privilegio `sismo_readonly`.
* **Streaming en Vivo (SSE):** Canal Server-Sent Events (`/api/stream`) para actualizar el mapa interactivo y métricas sin recargar el navegador.
* **Gobernanza con OpenMetadata:** Catálogo automatizado de metadatos, perfilado y linaje de datos de todos los esquemas.
* **Seguridad y Calidad Verificada:** 0 fugas de secretos en Git con **Gitleaks**, 0 vulnerabilidades con **Bandit**, y 15 pruebas automatizadas pasando al 100% con **Pytest**.

---

## 2. Guía de Inicio Rápido (Local Setup)

### 2.1 Requisitos Previos
* Docker y Docker Compose v2+
* Git
* Conexión a Internet (para descargar dependencias y consultar el API del USGS)

### 2.2 Despliegue de SismoWatch (Stack Principal)
1. **Clonar el repositorio:**
   ```bash
   git clone <url-del-repositorio>
   cd "prueba desempeño"
   ```

2. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   # El archivo .env ya viene preconfigurado con contraseñas seguras y la API Key de Groq
   ```

3. **Iniciar los servicios en segundo plano:**
   ```bash
   docker compose up -d --build
   ```

4. **Verificar que todos los contenedores estén saludables:**
   ```bash
   docker compose ps
   ```

### 2.3 Despliegue de OpenMetadata (Gobernanza y Catálogo)
Para iniciar el stack de gobernanza OpenMetadata y ejecutar la ingesta automatizada de esquemas:
```bash
# Iniciar servicios de OpenMetadata (Elasticsearch, MySQL, OpenMetadata Server e Ingestion)
docker compose -f docker-compose.openmetadata.yml up -d

# Esperar unos instantes a que el servidor inicialice (puerto 8585) y ejecutar la ingesta:
python3 openmetadata/run_ingestion.py
```

---

## 3. Servicios, Puertos y Credenciales

| Servicio | URL Local | Usuario | Contraseña | Rol / Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Web UI** | `http://localhost:3000` | `admin`<br>`viewer` | `admin123`<br>`admin123` | Dashboard interactivo, mapa Leaflet, gráficos y panel IA |
| **FastAPI Backend (Swagger)** | `http://localhost:8000/docs` | *(vía JWT login)* | *(vía JWT login)* | Documentación interactiva OpenAPI |
| **Airflow Web UI** | `http://localhost:8080` | `sismo_admin` | `admin123` | Orquestación, grafos, logs y datasets |
| **OpenMetadata UI** | `http://localhost:8585` | `admin@open-metadata.org` | `admin` | Catálogo de datos, esquemas y linaje |
| **PostgreSQL Database** | `localhost:5432` (`sismowatch`) | `postgres` | `admin123` | Superusuario administrativo |
| *Rol Ingesta DB* | Interno en Airflow | `sismo_ingest` | `admin123` | Solo INSERT en `bronze` |
| *Rol Transformación DB* | Interno en Airflow | `sismo_transform` | `admin123` | SELECT `bronze`, ALL en `silver` y `gold` |
| *Rol Lectura DB* | Exclusivo de FastAPI | `sismo_readonly` | `admin123` | Solo SELECT en `gold` (mínimo privilegio) |

---

## 4. Matriz de Control de Acceso (RBAC)

| Módulo / Acción | Rol `viewer` | Rol `admin` |
| :--- | :---: | :---: |
| Iniciar sesión y obtener JWT | ✅ | ✅ |
| Consultar KPIs y Estadísticas (`/api/kpis`) | ✅ | ✅ |
| Visualizar Mapa y Listado de Sismos (`/api/events`) | ✅ | ✅ |
| Consultar Series de Tiempo (`/api/stats/timeseries`) | ✅ | ✅ |
| Conectarse al stream en vivo SSE (`/api/stream`) | ✅ | ✅ |
| Descargar Reportes CSV y PDF (`/api/reports/export`) | ✅ | ✅ |
| Leer Reporte Ejecutivo de IA y Anomalías | ✅ | ✅ |
| **Interactuar con SismoBot Chatbot (`/api/chat`)** | ✅ | ✅ |
| **Disparar Backfill Histórico en Airflow (`/api/admin/backfill`)** | ❌ *(HTTP 403 Forbidden)* | ✅ *(HTTP 200/201 Queued)* |

---

## 5. Reglas de Calidad de Datos (Pandera)

El pipeline ejecuta contratos de datos declarativos mediante `Pandera` en cada lote:

| Parámetro | Regla / Restricción | Acción si Falla |
| :--- | :--- | :--- |
| `latitude` | Entre $-90.0^\circ$ y $+90.0^\circ$ | Marca `is_valid = FALSE`, se registra en `gold.quality_metrics` y **se excluye de Gold**. |
| `longitude` | Entre $-180.0^\circ$ y $+180.0^\circ$ | Marca `is_valid = FALSE` y se excluye de Gold. |
| `mag` (Magnitud) | Entre $-2.0$ y $10.0$ Richter/Mw | Marca `is_valid = FALSE` y se excluye de Gold. |
| `depth_km` (Profundidad) | Entre $-10.0$ y $1000.0$ km | Marca `is_valid = FALSE` y se excluye de Gold. |
| `id` / `place` | No nulos, no vacíos | Marca `is_valid = FALSE` y se excluye de Gold. |
| **Freshness (Frescura)** | Retraso menor a 180 minutos (3h) | Descuenta puntaje del quality score del lote. |
| **Volume (Volumen)** | Al menos 1 registro en el payload | Alerta por lote vacío. |
| **Quality Gate Threshold** | **Puntaje global $\ge 70\%$** | Si el puntaje es menor a 70%, el task falla y bloquea la promoción. |

---

## 6. Inteligencia Artificial y SismoBot (Chatbot Sísmico en Vivo)

* **Proveedor:** **Groq Cloud API** con procesadores LPU (ultra-baja latencia $<2$s).
* **Modelo:** `openai/gpt-oss-120b` (120B parámetros con salida estructurada).
* **Asistente Conversacional SismoBot (`POST /api/chat`):**
  - Permite a los usuarios consultar en lenguaje natural en tiempo real:
    - *📍 "¿Dónde hay más sismos?"* (ranking de concentración sísmica).
    - *📉 "¿Cuál es el lugar con menor actividad?"* (zonas de baja recurrencia o sismos aislados).
    - *📊 "Genérame un reporte ejecutivo"* (resumen 24h con eventos destacados y recomendaciones).
    - *⚠️ "¿Qué anomalías se han detectado?"* (outliers Z-Score $\ge 2.0$).
  - **Inyección de Hechos Verificados (Ground-Truth Context):** Antes de llamar a Groq, el backend extrae estadísticas y rankings de la capa Gold (`gold.earthquakes`) conectándose de manera segura con `sismo_readonly`.
* **Protección Anti-Inyección (OWASP LLM01):** Sanitización estricta de cadenas de texto libre para neutralizar instrucciones maliciosas o caracteres invisibles.
* **Barandilla Anti-Alucinación:** Python calcula los datos duros exactos y el modelo se ciñe a ellos.
* **Detección Estadística de Anomalías:** Algoritmo **Z-Score** ($z \ge 2.0$) que contrasta los eventos de las últimas 24 horas frente a la distribución histórica de magnitud y profundidad, persistiendo los eventos extremos en `gold.ai_anomalies`.
* **Failover Determinista (Plan B):** En caso de caída de internet o timeout del LLM, el pipeline autogenera un análisis técnico analítico garantizando cero roturas.
* **Auditoría de Costos y Telemetría:** Cada interacción reporta latencia en milisegundos, modelo utilizado y tokens.

---

## 7. Pruebas Automatizadas (Pytest)

Se incluye una suite completa de pruebas unitarias, de integración y de seguridad que se ejecuta con un único comando:

```bash
./run_tests.sh
```

### Cobertura de las 16 Pruebas:
1. **Transformaciones (`airflow/tests/test_transformations.py`):**
   - Conversión precisa de timestamps Epoch en milisegundos a objetos `datetime` UTC.
   - Normalización de GeoJSON anidado a columnas atómicas planas con manejo de geometrías nulas.
   - Manejo seguro de campos vacíos o valores atípicos.
2. **Integridad de DAGs (`airflow/tests/test_dag_integrity.py`):**
   - Carga del `DagBag` sin ningún error de importación (`import_errors == 0`).
   - Verificación de la presencia de los 4 DAGs del sistema (`usgs_ingest_dag`, `earthquakes_processing_dag`, `historical_backfill_dag`, `daily_ai_report_dag`).
   - Detección de ciclos (`check_cycle`) garantizando que los grafos sean estrictamente acíclicos.
   - Verificación de políticas de reintento (`retries >= 1`) y callbacks de alerta.
3. **Calidad de Datos con Pandera (`airflow/tests/test_quality.py`):**
   - Caso Válido: Registros dentro de los rangos obtienen 100% de quality score y estatus `PASSED`.
   - Caso Inválido: Registros con coordenadas fuera de rango, magnitud extrema o identificadores vacíos son marcados `is_valid = False` y rechazados del esquema Gold.
4. **Seguridad y RBAC en API (`airflow/tests/test_api_security.py`):**
   - Verificación del endpoint `/health` y conexión a la base de datos vía `sismo_readonly`.
   - Rechazo con **HTTP 401 Unauthorized** ante credenciales inválidas o ausencia de token.
   - Acceso exitoso del rol `viewer` a endpoints de lectura (`/api/kpis`, `/api/events`, etc.).
   - **Prueba Crítica de Seguridad RBAC:** Rechazo con **HTTP 403 Forbidden** cuando un usuario `viewer` intenta invocar la ruta administrativa `/api/admin/backfill`.
   - Ejecución exitosa de la ruta de backfill para el rol `admin`.
   - **Prueba del Chatbot Sísmico:** Validación de `POST /api/chat` respondiendo consultas en lenguaje natural con métricas vivas de Gold.

---

## 8. Evidencias de Seguridad y Auditoría de Código

### 8.1 Escaneo de Secretos con Gitleaks
Se ejecutó un análisis exhaustivo sobre **el 100% del historial de commits** del repositorio para garantizar la ausencia absoluta de credenciales o secretos duros:

```bash
docker run --rm -v "$(pwd):/path" zricethezav/gitleaks:latest detect --source="/path" -v
```
**Resultado:**
```text
3:15PM INF 10 commits scanned.
3:15PM INF scanned ~361834 bytes (361.83 KB) in 82.6ms
3:15PM INF no leaks found
```
> **Estado:** ✅ **0 FUGAS DE SECRETOS EN EL HISTORIAL DE GIT.**

### 8.2 Escaneo de Vulnerabilidades con Bandit
Se ejecutó el analizador de seguridad estática **Bandit** sobre el código fuente de las canalizaciones de datos y la API:

```bash
docker exec -u airflow sismowatch-airflow-webserver bandit -r /opt/airflow/dags /opt/airflow/include -ll
docker exec sismowatch-api bandit -r /app -ll
```
**Resultado:**
```text
Run started: 2026-10-27
Test results: No issues identified.
Total lines of code scanned: 2528
Total issues: Medium: 0, High: 0
```
> **Estado:** ✅ **0 VULNERABILIDADES MEDIAS O ALTAS DETECTADAS.**

---

## 9. Guía para la Captura de Evidencias (Screenshots)

Para documentar la entrega del proyecto, se sugiere capturar las siguientes evidencias visuales:

1. **Dashboard Principal (`http://localhost:3000`):**
   - Vista general en Dark Theme con el badge verde pulsante **"EN VIVO"**.
   - Los 4 KPIs superiores (Total Eventos 24h, Sismo Mayor, Calidad del Dato Pandera, Alertas de Tsunami).
   - Mapa interactivo con círculos coloreados por magnitud y tooltips al pasar el mouse.
   - Gráfico de actividad temporal y tabla paginada con filtros.
2. **Pestaña del Asistente Sísmico IA (`http://localhost:3000` -> Tab 'Asistente IA'):**
   - Interacción conversacional con SismoBot potenciado por `openai/gpt-oss-120b` en Groq.
   - Consultas demostradas: "¿Dónde hay más sismos?", "¿Cuál es el lugar con menor actividad?", "Genérame un reporte ejecutivo".
   - Telemetría en vivo: latencia en ms, modelo utilizado y sugerencias contextuales.
3. **Modal de Backfill Administrativo:**
   - Iniciar sesión como `admin` y abrir el modal "Disparar Backfill".
   - Iniciar sesión como `viewer` y evidenciar que el botón no está disponible o la llamada devuelve 403.
4. **Airflow Web UI (`http://localhost:8080`):**
   - Grid View mostrando las ejecuciones exitosas de los 4 DAGs:
     - `usgs_ingest_dag`
     - `earthquakes_processing_dag`
     - `historical_backfill_dag`
     - `daily_ai_report_dag`
   - Pestaña **Datasets** mostrando la dependencia reactiva sobre `sismowatch://bronze/earthquakes_raw`.
5. **OpenMetadata Data Catalog (`http://localhost:8585`):**
   - Página del servicio `sismowatch_postgres`.
   - Exploración de las tablas en los esquemas `bronze`, `silver` y `gold`.
   - Diagrama de linaje mostrando la relación `bronze` -> `silver` -> `gold`.
6. **Consola de Pruebas Automatizadas:**
   - Terminal ejecutando `./run_tests.sh` mostrando `16 passed in X.XXs (100%)`.
   - Terminal ejecutando el escaneo de **Gitleaks** mostrando `no leaks found`.

---

## 10. Estructura del Repositorio

```text
├── airflow/
│   ├── dags/
│   │   ├── usgs_ingest_dag.py             # Ingesta cada 5m a Bronze + emite Dataset
│   │   ├── earthquakes_processing_dag.py  # Procesamiento Silver/Gold reactivo por Dataset
│   │   ├── historical_backfill_dag.py     # Backfill histórico parametrizado con TaskGroups
│   │   └── daily_ai_report_dag.py         # Reporte diario con IA Groq + Z-Score
│   ├── include/
│   │   ├── db.py                          # Conexiones con roles least-privilege
│   │   ├── transformations.py             # Normalización de GeoJSON a tabular
│   │   ├── quality.py                     # Contratos de calidad Pandera
│   │   ├── alerts.py                      # Callbacks y actualización de salud
│   │   └── ai/
│   │       ├── client.py                  # Cliente Groq con telemetría y Plan B
│   │       ├── prompts.py                 # Prompts versionados
│   │       ├── schemas.py                 # Esquemas Pydantic para JSON estricto
│   │       ├── sanitizer.py               # Sanitizador Anti-Prompt Injection
│   │       ├── validator.py               # Barandilla Anti-Alucinación
│   │       └── anomaly_detector.py        # Detector Z-Score (z >= 2.0)
│   ├── tests/
│   │   ├── test_transformations.py        # Tests unitarios de transformación
│   │   ├── test_dag_integrity.py          # Tests de integridad del DagBag
│   │   ├── test_quality.py                # Tests Pandera casos válidos e inválidos
│   │   └── test_api_security.py           # Tests de API, JWT y RBAC 401/403
│   ├── Dockerfile
│   └── requirements.txt
├── api/
│   ├── main.py                            # FastAPI app, CORS, ciclo de vida
│   ├── config.py                          # Carga de variables de entorno
│   ├── auth.py                            # JWT HS256 y RBAC dependencies
│   ├── database.py                        # Conexión exclusiva sismo_readonly
│   ├── schemas.py                         # Modelos Pydantic v2 de respuesta
│   ├── routers/
│   │   ├── auth.py                        # Endpoint /auth/login
│   │   ├── earthquakes.py                 # KPIs, listado paginado y series temporales
│   │   ├── reports.py                     # Exportación CSV y PDF
│   │   ├── chat.py                        # Endpoint conversacional SismoBot con Groq AI
│   │   ├── stream.py                      # Canal Server-Sent Events en vivo
│   │   └── admin.py                       # Disparo de backfill (Solo Admin)
│   ├── Dockerfile
│   └── requirements.txt
├── web/
│   ├── src/
│   │   ├── App.tsx                        # Componente raíz con Auth y Estado SSE
│   │   ├── components/
│   │   │   ├── Header.tsx                 # Barra superior con status live y login
│   │   │   ├── KPICards.tsx               # 4 métricas clave en tiempo real
│   │   │   ├── EarthquakeMap.tsx          # Mapa interactivo Leaflet
│   │   │   ├── ActivityChart.tsx          # Gráficos de barras y líneas
│   │   │   ├── EarthquakesTable.tsx       # Tabla paginada con filtros y exportación
│   │   │   ├── AIChatBotView.tsx          # Asistente sísmico conversacional SismoBot
│   │   │   └── BackfillModal.tsx          # Modal de ejecución de backfill
│   │   └── types.ts                       # Tipos TypeScript
│   ├── Dockerfile
│   └── package.json
├── db/
│   └── init/
│       └── 01_init_schemas_roles.sql      # Medallion DDL y roles least-privilege
├── openmetadata/
│   └── run_ingestion.py                   # Script de ingesta automatizada en OpenMetadata
├── docs/
│   └── ARQUITECTURA.md                    # Documentación técnica profunda y diagramas
├── docker-compose.yml                     # Orquestación del stack SismoWatch
├── docker-compose.openmetadata.yml        # Orquestación del stack OpenMetadata
├── run_tests.sh                           # Script ejecutable de pruebas automatizadas
├── .env.example                           # Plantilla de variables de entorno
└── README.md                              # Guía del proyecto y entrega
```
