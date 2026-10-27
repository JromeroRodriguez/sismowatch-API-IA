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

export interface QuarantineItem {
  id: string;
  place?: string;
  mag?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  depth_km?: number | null;
  rejection_reason: string;
  rejected_at: string;
}

export interface PipelineSummary {
  statuses: PipelineStatusItem[];
  latest_quality: QualityMetricItem | null;
}

export interface ReportItem {
  id: number;
  report_date: string;
  title?: string;
  summary_narrative: string;
  total_events: number;
  max_magnitude?: number;
  avg_magnitude?: number;
  tsunami_events: number;
  most_active_region?: string;
  model_used: string;
  tokens_used: number;
  latency_ms: number;
  cost_estimate_usd: number;
  generated_at: string;
}

export interface AnomalyItem {
  id: number;
  event_id?: string;
  detection_date: string;
  technique: string;
  place?: string;
  magnitude?: number;
  depth_km?: number;
  anomaly_score?: number;
  explanation: string;
}

export interface UserSession {
  username: string;
  role: 'admin' | 'viewer';
  token: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  latency_ms?: number;
}

export interface ChatResponse {
  reply: string;
  suggested_questions: string[];
  model: string;
  latency_ms: number;
  context_used?: Record<string, any>;
}
