-- =====================================================================
-- SismoWatch - Database Initialization Script
-- Architecture: Medallion (bronze, silver, gold)
-- Security: Least Privilege Database Roles
-- =====================================================================

-- 1. Create separate databases for Airflow metadata and SismoWatch data
CREATE DATABASE airflow;
CREATE DATABASE sismowatch;

\connect sismowatch;

-- 2. Create Medallion Schemas
CREATE SCHEMA IF NOT EXISTS bronze;
CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;

-- 3. Create Least-Privilege Users & Roles
-- Passwords match .env
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sismo_ingest') THEN
        CREATE USER sismo_ingest WITH PASSWORD 'admin123';
    ELSE
        ALTER USER sismo_ingest WITH PASSWORD 'admin123';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sismo_transform') THEN
        CREATE USER sismo_transform WITH PASSWORD 'admin123';
    ELSE
        ALTER USER sismo_transform WITH PASSWORD 'admin123';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sismo_readonly') THEN
        CREATE USER sismo_readonly WITH PASSWORD 'admin123';
    ELSE
        ALTER USER sismo_readonly WITH PASSWORD 'admin123';
    END IF;
END
$$;

-- Revoke default public schema access
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- =====================================================================
-- Schema: BRONZE (Raw ingestion layer)
-- =====================================================================
CREATE TABLE IF NOT EXISTS bronze.earthquakes_raw (
    id VARCHAR(64) PRIMARY KEY,
    raw_payload JSONB NOT NULL,
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(32) DEFAULT 'usgs_feed'
);

CREATE INDEX IF NOT EXISTS idx_bronze_ingested_at ON bronze.earthquakes_raw(ingested_at);

-- =====================================================================
-- Schema: SILVER (Cleaned, typed, and structured layer)
-- =====================================================================
CREATE TABLE IF NOT EXISTS silver.earthquakes_clean (
    id VARCHAR(64) PRIMARY KEY,
    mag NUMERIC(4,2),
    place VARCHAR(255),
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    updated TIMESTAMP WITH TIME ZONE,
    tz INT,
    url TEXT,
    detail TEXT,
    felt INT,
    cdi NUMERIC(4,1),
    mmi NUMERIC(4,1),
    alert VARCHAR(16),
    status VARCHAR(32),
    tsunami INT DEFAULT 0,
    sig INT DEFAULT 0,
    net VARCHAR(16),
    code VARCHAR(32),
    ids TEXT,
    sources TEXT,
    types TEXT,
    nst INT,
    dmin NUMERIC(7,3),
    rms NUMERIC(5,2),
    gap NUMERIC(5,1),
    mag_type VARCHAR(16),
    type VARCHAR(32),
    title TEXT,
    longitude NUMERIC(9,6) NOT NULL,
    latitude NUMERIC(9,6) NOT NULL,
    depth_km NUMERIC(7,2) NOT NULL,
    is_valid BOOLEAN DEFAULT TRUE,
    cleaned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_silver_time ON silver.earthquakes_clean(time);
CREATE INDEX IF NOT EXISTS idx_silver_is_valid ON silver.earthquakes_clean(is_valid);

-- =====================================================================
-- Schema: GOLD (Curated, validated consumption layer - NO quarantine)
-- =====================================================================
CREATE TABLE IF NOT EXISTS gold.earthquakes (
    id VARCHAR(64) PRIMARY KEY,
    mag NUMERIC(4,2) NOT NULL,
    place VARCHAR(255) NOT NULL,
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    updated TIMESTAMP WITH TIME ZONE,
    tsunami INT NOT NULL DEFAULT 0,
    sig INT NOT NULL DEFAULT 0,
    status VARCHAR(32),
    mag_type VARCHAR(16),
    type VARCHAR(32),
    url TEXT,
    longitude NUMERIC(9,6) NOT NULL,
    latitude NUMERIC(9,6) NOT NULL,
    depth_km NUMERIC(7,2) NOT NULL,
    curated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gold_time ON gold.earthquakes(time DESC);
CREATE INDEX IF NOT EXISTS idx_gold_mag ON gold.earthquakes(mag);
CREATE INDEX IF NOT EXISTS idx_gold_tsunami ON gold.earthquakes(tsunami);

-- Quality metrics table
CREATE TABLE IF NOT EXISTS gold.quality_metrics (
    run_id VARCHAR(128) PRIMARY KEY,
    dag_id VARCHAR(64) NOT NULL,
    execution_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_records INT NOT NULL,
    rules_evaluated INT NOT NULL,
    rules_passed INT NOT NULL,
    rules_rejected INT NOT NULL,
    quality_score NUMERIC(5,2) NOT NULL,
    freshness_minutes NUMERIC(8,2),
    status VARCHAR(32) NOT NULL,
    details JSONB
);

CREATE INDEX IF NOT EXISTS idx_quality_timestamp ON gold.quality_metrics(execution_timestamp DESC);

-- Quality quarantine table (records rejected by quality gate)
CREATE TABLE IF NOT EXISTS gold.quality_quarantine (
    id VARCHAR(64) PRIMARY KEY,
    place VARCHAR(255),
    mag NUMERIC(4,2),
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    depth_km NUMERIC(7,2),
    rejection_reason TEXT NOT NULL,
    rejected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    raw_payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_quarantine_rejected_at ON gold.quality_quarantine(rejected_at DESC);

-- AI Reports narrative table
CREATE TABLE IF NOT EXISTS gold.ai_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL UNIQUE,
    summary_narrative TEXT NOT NULL,
    total_events INT NOT NULL,
    max_magnitude NUMERIC(4,2) NOT NULL,
    avg_magnitude NUMERIC(4,2) NOT NULL,
    tsunami_events INT NOT NULL DEFAULT 0,
    most_active_region VARCHAR(255),
    model_used VARCHAR(64) NOT NULL,
    tokens_used INT DEFAULT 0,
    latency_ms INT DEFAULT 0,
    cost_estimate_usd NUMERIC(8,6) DEFAULT 0.0,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI Anomalies table
CREATE TABLE IF NOT EXISTS gold.ai_anomalies (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(64) REFERENCES gold.earthquakes(id) ON DELETE CASCADE,
    detection_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    technique VARCHAR(64) NOT NULL,
    place VARCHAR(255),
    magnitude NUMERIC(4,2),
    depth_km NUMERIC(7,2),
    anomaly_score NUMERIC(6,4),
    explanation TEXT NOT NULL
);

-- Pipeline health & DAG execution monitoring
CREATE TABLE IF NOT EXISTS gold.pipeline_status (
    dag_id VARCHAR(64) PRIMARY KEY,
    last_run_id VARCHAR(128),
    state VARCHAR(32),
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- PERMISSIONS & ROLES (Least Privilege)
-- =====================================================================

-- 1. Ingestion Role (sismo_ingest)
-- CAN: Write and read from BRONZE schema only
GRANT USAGE, CREATE ON SCHEMA bronze TO sismo_ingest;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA bronze TO sismo_ingest;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA bronze GRANT SELECT, INSERT, UPDATE ON TABLES TO sismo_ingest;
ALTER DEFAULT PRIVILEGES FOR ROLE sismo_ingest IN SCHEMA bronze GRANT SELECT, INSERT, UPDATE ON TABLES TO sismo_ingest;

-- 2. Transformation Role (sismo_transform)
-- CAN: Read BRONZE, full access to SILVER and GOLD
GRANT USAGE ON SCHEMA bronze TO sismo_transform;
GRANT SELECT ON ALL TABLES IN SCHEMA bronze TO sismo_transform;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA bronze GRANT SELECT ON TABLES TO sismo_transform;
ALTER DEFAULT PRIVILEGES FOR ROLE sismo_ingest IN SCHEMA bronze GRANT SELECT ON TABLES TO sismo_transform;

GRANT USAGE, CREATE ON SCHEMA silver TO sismo_transform;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA silver TO sismo_transform;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA silver TO sismo_transform;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA silver GRANT ALL ON TABLES TO sismo_transform;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA silver GRANT ALL ON SEQUENCES TO sismo_transform;
ALTER DEFAULT PRIVILEGES FOR ROLE sismo_transform IN SCHEMA silver GRANT ALL ON TABLES TO sismo_transform;
ALTER DEFAULT PRIVILEGES FOR ROLE sismo_transform IN SCHEMA silver GRANT ALL ON SEQUENCES TO sismo_transform;

GRANT USAGE, CREATE ON SCHEMA gold TO sismo_transform;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA gold TO sismo_transform;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA gold TO sismo_transform;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA gold GRANT ALL ON TABLES TO sismo_transform;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA gold GRANT ALL ON SEQUENCES TO sismo_transform;
ALTER DEFAULT PRIVILEGES FOR ROLE sismo_transform IN SCHEMA gold GRANT ALL ON TABLES TO sismo_transform;
ALTER DEFAULT PRIVILEGES FOR ROLE sismo_transform IN SCHEMA gold GRANT ALL ON SEQUENCES TO sismo_transform;

-- 3. Readonly Role (sismo_readonly)
-- CAN: ONLY SELECT on GOLD schema (used exclusively by FastAPI platform)
-- CANNOT access bronze or silver!
GRANT USAGE ON SCHEMA gold TO sismo_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA gold TO sismo_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA gold GRANT SELECT ON TABLES TO sismo_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE sismo_transform IN SCHEMA gold GRANT SELECT ON TABLES TO sismo_readonly;
