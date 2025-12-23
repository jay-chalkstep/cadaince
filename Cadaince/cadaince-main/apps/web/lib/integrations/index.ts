// Integration Layer Exports

// Types
export * from "./types";

// HubSpot
export { hubspotClient, fetchHubSpotMetric } from "./hubspot/client";

// BigQuery
export { bigqueryClient, fetchBigQueryMetric } from "./bigquery/client";

// Sync
export { syncMetric, syncAllMetrics, getSyncStatus } from "./sync/processor";
export {
  detectAnomalies,
  getMetricAnomalies,
  getUnresolvedAnomalies,
} from "./sync/anomaly";
export {
  scheduledMetricSync,
  manualMetricSync,
  runAnomalyDetection,
} from "./sync/scheduler";
