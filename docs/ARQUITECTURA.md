# Documento de Arquitectura del Sistema: SismoWatch

## 1. Visión General y Propósito del Sistema

**SismoWatch** es una plataforma integral de ingeniería de datos, observabilidad sísmica en tiempo real, control riguroso de calidad de datos e inteligencia analítica automatizada mediante Inteligencia Artificial Generativa.

El sistema ingesta de manera continua eventos sísmicos globales reportados por el catálogo público del **USGS (United States Geological Survey)**, aplica transformaciones deterministas, valida la calidad de cada lote mediante contratos de datos declarativos (**Pandera**), clasifica la información bajo el paradigma de **Arquitectura Medallion** (`bronze`, `silver`, `gold`), expone APIs seguras con control de acceso basado en roles (**RBAC** con JWT), transmite eventos en vivo mediante **Server-Sent Events (SSE)** hacia una interfaz moderna en **React + TypeScript**, genera análisis narrativos diarios con modelos de lenguaje de gran escala (**Groq AI - `openai/gpt-oss-120b`**) protegidos contra alucinaciones y prompt injection, y cataloga todos los activos en **OpenMetadata** para gobernanza y linaje.

---

## 2. Analogías Intuitivas para Comprender la Arquitectura

Para facilitar la comprensión tanto a perfiles junior como a tomadores de decisión no técnicos, la arquitectura de SismoWatch se fundamenta en dos analogías del mundo real:

### Analogía 1: La Cocina de un Restaurante de Alta Gama (Arquitectura Medallion)
* **Capa Bronze (El muelle de descarga y almacén en bruto):** Los camiones de los proveedores llegan con ingredientes en sus cajas originales. Aquí no se lava, pela ni cocina nada; se descarga exactamente como llegó (GeoJSON crudo) para que siempre exista un registro fiel de la mercancía. Si un cocinero se equivoca más tarde, siempre podemos volver al almacén y ver el ingrediente original.
* **Capa Silver (La mesa de preparación, lavado y corte):** Los ayudantes de cocina lavan las verduras, desechan lo que esté en mal estado (`is_valid = FALSE`) y cortan en porciones estandarizadas (tipos `TIMESTAMP`, `FLOAT`, columnas atómicas). La verdura dañada se registra como merma pero **nunca** pasa a la cocina caliente.
* **Capa Gold (La mesa de emplatado para los comensales):** Solo los ingredientes 100% aptos y preparados llegan a la sartén del chef. Es la capa que consumen los clientes del restaurante (FastAPI, el mapa interactivo y el modelo de IA). Garantiza que ningún cliente coma verdura sucia.

### Analogía 2: Las Llaves de Acceso de un Hotel (Principio de Menor Privilegio)
* El huésped (**Rol Viewer / `sismo_readonly`**) solo tiene tarjeta para entrar a su habitación y al restaurante (Capa Gold). No puede entrar a la cocina ni a la bóveda administrativa.
* El cocinero (**Rol Ingest / `sismo_ingest`**) solo tiene llave del muelle de descarga (Capa Bronze). No puede alterar el menú servido al comensal.
* El sous-chef (**Rol Transform / `sismo_transform`**) tiene acceso para tomar del muelle, limpiar en la mesa y servir en la mesa de emplatado (Bronze a Silver y Silver a Gold).
* Si un atacante roba la llave de un huésped, jamás podrá alterar los ingredientes ni envenenar el almacén.

---

## 3. Diagrama Integral de Arquitectura

```mermaid
flowchart TD
    subgraph FuentesExternas ["1. Fuente de Datos Externa"]
        USGS["USGS Earthquake API\n(/summary/all_hour.geojson & /query)"]
    end

    subgraph Orquestacion ["2. Orquestación y Calidad (Apache Airflow 2.9.2)"]
        DAG1["DAG: usgs_ingest_dag\n(Cada 5 mins / Idempotente)"]
        DS[("Dataset: sismowatch://bronze/earthquakes_raw")]
        DAG2["DAG: earthquakes_processing_dag\n(Trigger reactivo por Dataset)"]
        DAG3["DAG: historical_backfill_dag\n(TaskGroups: Ingest + Process)"]
        DAG4["DAG: daily_ai_report_dag\n(06:00 UTC / On-Demand)"]
        
        QGate{"Quality Gate\n(Pandera Schema\nScore >= 70%)"}
        Sanitizer["Sanitizador de Prompts\n(Anti-Inyección OWASP LLM01)"]
        ZScore["Detector de Anomalías\n(Z-Score >= 2.0)"]
        AntiHallucination{"Validador Anti-Alucinación\n(Cálculo Exacto en Python)"}
    end

    subgraph BaseDatos ["3. Almacén de Datos (PostgreSQL 16 - Medallion)"]
        subgraph BronzeSchema ["Schema: bronze (Rol: sismo_ingest)"]
            TBronze[("earthquakes_raw\n(JSONB crudo + ingestion_id)")]
        end
        subgraph SilverSchema ["Schema: silver (Rol: sismo_transform)"]
            TSilver[("earthquakes_clean\n(Tipado estricto, is_valid flag)")]
        end
        subgraph GoldSchema ["Schema: gold (Rol: sismo_readonly para consumo)"]
            TGold[("earthquakes\n(Solo eventos válidos)")]
            TMetrics[("quality_metrics\n(Scores, rechazados, reglas)")]
            TStatus[("pipeline_status\n(Salud y alertas de DAGs)")]
            TReports[("ai_reports\n(Narrativas diarias + tokens/costos)")]
            TAnomalies[("ai_anomalies\n(Outliers detectados con Z-score)")]
        end
    end

    subgraph ProveedorIA ["4. Inteligencia Artificial (Groq Cloud)"]
        Groq["Groq Cloud API\n(LPU Ultra-Baja Latencia)"]
        Model["Modelo: openai/gpt-oss-120b\n(JSON Estructurado)"]
        PlanB["Fallback Determinista\n(Plan B Cero-Fallas)"]
    end

    subgraph BackendAPI ["5. Capa de Servicios (FastAPI + JWT)"]
        API["FastAPI Backend\n(Conexión exclusiva con sismo_readonly)"]
        AuthModule["Módulo de Autenticación\n(JWT HS256 / RBAC)"]
        SSEModule["Stream Server-Sent Events\n(Canal en vivo /api/stream)"]
        ExportModule["Módulo de Exportación\n(CSV y PDF nativos)"]
    end

    subgraph FrontendApp ["6. Interfaz de Usuario (React 18 + TS)"]
        Web["React + Vite + Tailwind CSS\n(Dark Theme #0f172a)"]
        LiveIndicator["Badge 'EN VIVO' (SSE)"]
        LeafletMap["Mapa Interactivo Leaflet\n(Círculos por magnitud y color)"]
        ChartModule["Gráficos de Frecuencia y Distribución"]
        AITab["Panel de Inteligencia IA & Anomalías"]
        BackfillModal["Modal de Backfill (Solo Admin)"]
    end

    subgraph Gobernanza ["7. Catálogo y Linaje (OpenMetadata)"]
        OMServer["OpenMetadata Server (8585)"]
        OMIngest["Workflow de Ingesta Automatizado\n(openmetadata/run_ingestion.py)"]
    end

    %% Relaciones de flujo
    USGS -->|HTTP GET GeoJSON| DAG1
    USGS -->|HTTP GET Rango Histórico| DAG3
    DAG1 -->|INSERT sismo_ingest| TBronze
    DAG1 -->|Emite actualización| DS
    DS -->|Activa ejecución| DAG2
    TBronze -->|SELECT sismo_transform| DAG2
    DAG2 -->|Validación Pandera| QGate
    QGate -->|is_valid=FALSE| TSilver
    QGate -->|is_valid=TRUE| TSilver
    QGate -->|Métricas de Calidad| TMetrics
    TSilver -->|SELECT is_valid=TRUE| DAG2
    DAG2 -->|INSERT / UPDATE sismo_transform| TGold
    
    TGold -->|Consulta 24h & Histórico| DAG4
    DAG4 -->|Detección Z-Score| ZScore
    ZScore -->|INSERT sismo_transform| TAnomalies
    DAG4 -->|Limpieza de texto| Sanitizer
    Sanitizer -->|Prompt seguro| Groq
    Groq --> Model
    Model -.->|Falla o Timeout| PlanB
    Model --> AntiHallucination
    PlanB --> AntiHallucination
    AntiHallucination -->|INSERT sismo_transform| TReports

    DAG1 & DAG2 & DAG3 & DAG4 -.->|Callbacks on_failure / on_success| TStatus

    TGold & TMetrics & TStatus & TReports & TAnomalies -->|SELECT sismo_readonly| API
    API --> Web
    SSEModule --> LiveIndicator
    ExportModule --> Web
    BackfillModal -->|POST /api/admin/backfill (RBAC: Admin)| API
    API -->|Airflow REST API Trigger| DAG3

    BaseDatos -->|Metadatos de esquemas y tablas| OMIngest
    OMIngest -->|Registro REST API| OMServer
```

---

## 4. Justificación de Herramientas y Análisis de Trade-Offs

Cada decisión técnica adoptada en SismoWatch responde a requerimientos de robustez, escalabilidad y mantenimiento operativo:

| Componente | Opción Elegida | Alternativa Descartada | Justificación y Trade-Off |
| :--- | :--- | :--- | :--- |
| **Orquestador** | **Apache Airflow 2.9.2** | Cron Jobs en Linux | **Por qué:** Airflow ofrece grafos acíclicos dirigidos (DAGs), orquestación reactiva con **Datasets** (event-driven), reintentos automáticos con backoff exponencial, trazabilidad de logs por tarea, observabilidad gráfica y ejecución parametrizada. Cron es ciego, no tiene noción de dependencias, reintentos ni estado. |
| **Arquitectura de Datos** | **Medallion (Bronze/Silver/Gold)** | Esquema Plano Monolítico | **Por qué:** Medallion asegura inmutabilidad de la auditoría en Bronze (nunca se pierde la fuente original), permite reprocesamiento histórico si las reglas de negocio cambian, y garantiza que la capa Gold sea 100% de grado analítico y solo contenga datos válidos. Un esquema plano sufre bloqueos, mutabilidad descontrolada y contaminación de datos sucios. |
| **Validación de Calidad** | **Pandera** | Great Expectations | **Por qué:** Pandera es ligero, declarativo, se integra de forma transparente con DataFrames de Pandas dentro de los operadores de Airflow y permite validación estadística en memoria con bajísima sobrecarga computacional. Great Expectations introduce dependencias pesadas, almacenes JSON externos y complejidad operativa innecesaria para micro-lotes de 5 minutos. |
| **Motor de IA** | **Groq Cloud (`openai/gpt-oss-120b`)** | LLM Local (Ollama / Llama.cpp) | **Por qué:** Groq utiliza procesadores LPU (Language Processing Units) que entregan respuestas a más de 300 tokens/segundo con latencias de 1-4 segundos, permitiendo utilizar un modelo de 120 mil millones de parámetros sin saturar la GPU/CPU del servidor local. La compatibilidad nativa con el protocolo OpenAI facilitó la configuración de salida JSON estructurada y el failover. |
| **Gobernanza de Datos** | **OpenMetadata** | DataHub / Catálogo Manual | **Por qué:** OpenMetadata es open-source, nativo de la nube, se despliega en contenedores Docker y provee recolección automatizada de esquemas PostgreSQL, perfilamiento de datos y seguimiento de linaje de datos con una interfaz moderna y API REST completa. |
| **Backend** | **FastAPI (Python 3.11)** | Django / Flask | **Por qué:** FastAPI ofrece alto rendimiento asíncrono nativo (`asyncio`), soporte integrado para Server-Sent Events (SSE) sin brokers externos, generación automática de documentación interactiva OpenAPI/Swagger y validación tipada estricta mediante Pydantic v2. |
| **Frontend** | **React 18 + Vite + Tailwind CSS** | Dash / Streamlit | **Por qué:** Las interfaces en Streamlit/Dash sufren de recargas globales de estado que degradan la experiencia de tiempo real y mapas interactivos. React con Vite y Leaflet permite renderizar mapas de alta densidad, alimentar el badge "EN VIVO" vía SSE sin parpadeos y aplicar un diseño profesional Dark Mode con microinteracciones fluidas. |

---

## 5. Diseño de Seguridad y Mínimo Privilegio (PoLP)

SismoWatch implementa una postura de seguridad en profundidad (*Defense in Depth*):

### 5.1 Roles de Base de Datos Estrictos
1. **`sismo_ingest`:**
   - Permiso único: `INSERT` sobre `bronze.earthquakes_raw`.
   - No puede leer ni escribir en `silver` ni `gold`.
2. **`sismo_transform`:**
   - Permisos: `SELECT` en `bronze`; `ALL` en `silver`; `ALL` en `gold`.
   - Encargado exclusivo de aplicar transformaciones, Pandera y cargar los reportes y anomalías.
3. **`sismo_readonly`:**
   - Permiso único: `SELECT` exclusivamente sobre el esquema `gold`.
   - La API de FastAPI **únicamente** se conecta con este usuario. Si la API fuese vulnerada, el atacante no tiene permisos de inserción, actualización, borrado ni acceso a las capas bronze o silver.

### 5.2 Control de Acceso en API (RBAC)
* Autenticación mediante tokens **JWT (HS256)** con expiración.
* Rutas de lectura (`/api/kpis`, `/api/events`, `/api/stats/timeseries`, `/api/stream`, `/api/reports/export`): abiertas para roles `viewer` y `admin`.
* Ruta de administración (`/api/admin/backfill`): protegida estrictamente. Un usuario con rol `viewer` recibe de forma inmediata **HTTP 403 Forbidden**.

### 5.3 Seguridad en la Capa de Inteligencia Artificial
* **Anti-Prompt Injection (OWASP LLM01):** El campo libre `place` proveniente del USGS es sanitizado mediante expresiones regulares para remover prefijos de ataque como `ignore previous instructions`, `system override`, `you are now a hacker`, caracteres de control y secuencias de inyección.
* **Barandilla Anti-Alucinación (Ground-Truth Gate):** Antes de enviar el prompt, Python calcula las estadísticas matemáticas exactas (total de sismos, magnitud máxima, zona principal). La respuesta de la IA se parsea con Pydantic y un validador numérico comprueba que los números en el texto coincidan con los datos calculados.
* **Plan B Determinista (Cero-Fallas):** Si el proveedor de IA experimenta fallos de conectividad, caída de servicio o excede el timeout de 30 segundos, el sistema genera automáticamente un reporte sintético estructurado basado en plantillas matemáticas, garantizando que el pipeline nunca se rompa.

---

## 6. Monitoreo, Linaje y Gobierno con OpenMetadata

Todos los esquemas y tablas de la plataforma están catalogados en OpenMetadata bajo el servicio `sismowatch_postgres`:
* **Esquema `bronze`:** `earthquakes_raw` (catálogo del payload GeoJSON original y trazabilidad de ingestión).
* **Esquema `silver`:** `earthquakes_clean` (catálogo de columnas tipadas y bandera `is_valid`).
* **Esquema `gold`:** `earthquakes`, `quality_metrics`, `pipeline_status`, `ai_reports`, `ai_anomalies`.

El linaje de datos evidencia que la tabla `gold.earthquakes` proviene de transformaciones y filtrado de calidad desde `silver.earthquakes_clean`, la cual a su vez deriva de `bronze.earthquakes_raw`, asegurando cumplimiento normativo y transparencia total en la trazabilidad del dato.
