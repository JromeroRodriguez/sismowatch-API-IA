export interface Earthquake {
  id: string;
  place: string;
  time: string;
  updated?: string;
  latitude: number;
  longitude: number;
  depth_km: number;
  mag: number;
  mag_type?: string;
  tsunami: number;
  sig: number;
  status: string;
  event_type?: string;
  url?: string;
  ingested_at?: string;
}

export interface PaginatedEarthquakes {
  items: Earthquake[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface KPIsResponse {
  total_events_24h: number;
  max_magnitude_24h: number | null;
  avg_magnitude_24h: number | null;
  tsunami_alerts_24h: number;
  latest_event_time: string | null;
  quality_score: number;
  data_freshness_minutes: number | null;
  total_events_gold: number;
}

export interface TimeSeriesPoint {
  time_bucket: string;
  count: number;
  max_mag: number | null;
  avg_mag: number | null;
}

export interface PipelineStatusItem {
  dag_id: string;
  state: string | null;
  last_run_id: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  updated_at: string | null;
}

export interface QualityMetricItem {
  run_id: string;
  dag_id: string;
  execution_timestamp: string | null;
  total_records: number;
  rules_evaluated: number;
  rules_passed: number;
  rules_rejected: number;
  quality_score: number;
  freshness_minutes: number | null;
  status: string;
  details?: Record<string, any>;
}

export interface PipelineSummary {
  statuses: PipelineStatusItem[];
  latest_quality: QualityMetricItem | null;
}

export interface UserSession {
  username: string;
  role: 'admin' | 'viewer';
  token: string;
}
