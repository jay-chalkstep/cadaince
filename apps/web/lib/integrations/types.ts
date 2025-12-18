// Integration Types

export interface Integration {
  id: string;
  type: "hubspot" | "bigquery" | "slack" | "google_calendar";
  name: string;
  is_active: boolean;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  integration_id: string;
  metric_id: string | null;
  started_at: string;
  completed_at: string | null;
  status: "running" | "success" | "error";
  records_processed: number | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
}

export interface MetricSourceConfig {
  source_type: "manual" | "hubspot" | "bigquery" | "calculated";
  source_config: HubSpotMetricConfig | BigQueryMetricConfig | CalculatedMetricConfig | null;
}

// HubSpot Types
export interface HubSpotMetricConfig {
  object: "deals" | "contacts" | "tickets" | "feedback_submissions";
  property: string;
  aggregation: "sum" | "avg" | "count" | "min" | "max";
  filters?: Record<string, unknown>;
  date_range?: "today" | "week" | "month" | "quarter" | "year" | "custom";
  custom_date_field?: string;
}

export interface HubSpotDeal {
  id: string;
  properties: Record<string, string>;
}

export interface HubSpotSearchResponse {
  total: number;
  results: HubSpotDeal[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

// BigQuery Types
export interface BigQueryMetricConfig {
  query: string;
  value_column: string;
  dataset?: string;
  parameters?: Record<string, string>;
}

export interface BigQueryResult {
  value: number;
  metadata?: Record<string, unknown>;
}

// Calculated Metric Types
export interface CalculatedMetricConfig {
  formula: string;
  dependencies: string[]; // Array of metric IDs
}

// Anomaly Detection Types
export interface AnomalyResult {
  metric_id: string;
  metric_name: string;
  anomaly_type: "threshold" | "deviation" | "trend" | "missing";
  severity: "info" | "warning" | "critical";
  current_value: number | null;
  expected_value: number | null;
  deviation_percent: number | null;
  message: string;
  detected_at: string;
}

export interface ThresholdConfig {
  id: string;
  metric_id: string;
  threshold_type: "above" | "below" | "change_percent";
  threshold_value: number;
  severity: "info" | "warning" | "critical";
  consecutive_periods: number;
  is_active: boolean;
}

// Sync Result Types
export interface SyncResult {
  success: boolean;
  value?: number;
  error?: string;
  records_processed?: number;
  details?: Record<string, unknown>;
}
