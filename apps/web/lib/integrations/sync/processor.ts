import { createAdminClient } from "@/lib/supabase/server";
import { fetchHubSpotMetric } from "../hubspot/client";
import { fetchBigQueryMetric } from "../bigquery/client";
import { hubspotClient } from "../hubspot/client";
import { bigqueryClient } from "../bigquery/client";
import {
  getTimeRange,
  formatDateISO,
  type TimeWindow,
} from "./time-windows";
import { syncCalculatedMetric } from "./formula";
import type {
  HubSpotMetricConfig,
  BigQueryMetricConfig,
  SyncResult,
} from "../types";

interface LegacyMetric {
  id: string;
  name: string;
  source_type: string;
  source_config: Record<string, unknown> | null;
  owner_id: string;
}

interface DataSourceMetric {
  id: string;
  name: string;
  metric_type: "single_window" | "multi_window";
  data_source_id: string;
  time_window: string | null;
  time_windows: string[] | null;
  owner_id: string;
  data_source?: DataSource;
}

interface DataSource {
  id: string;
  name: string;
  source_type: "hubspot" | "bigquery";
  hubspot_object: string | null;
  hubspot_property: string | null;
  hubspot_aggregation: string | null;
  hubspot_filters: unknown[] | null;
  bigquery_query: string | null;
  bigquery_value_column: string | null;
  unit: string | null;
}

/**
 * Fetch value from a data source for a specific time window
 */
async function fetchDataSourceValue(
  dataSource: DataSource,
  timeWindow: TimeWindow
): Promise<SyncResult> {
  const { start, end } = getTimeRange(timeWindow);

  if (dataSource.source_type === "hubspot") {
    if (!hubspotClient.isConfigured()) {
      return { success: false, error: "HubSpot not configured" };
    }

    return hubspotClient.fetchMetric({
      object: dataSource.hubspot_object as "deals" | "contacts" | "tickets" | "feedback_submissions",
      property: dataSource.hubspot_property!,
      aggregation: dataSource.hubspot_aggregation as "sum" | "avg" | "count" | "min" | "max",
      filters: dataSource.hubspot_filters as unknown as Record<string, unknown> | undefined,
      date_range: "custom",
      custom_date_field: "createdate",
    });
  } else if (dataSource.source_type === "bigquery") {
    if (!bigqueryClient.isConfigured()) {
      return { success: false, error: "BigQuery not configured" };
    }

    // Replace time placeholders
    const query = dataSource.bigquery_query!
      .replace(/\{\{start\}\}/g, formatDateISO(start))
      .replace(/\{\{end\}\}/g, formatDateISO(end));

    return bigqueryClient.fetchMetric({
      query,
      value_column: dataSource.bigquery_value_column!,
    });
  }

  return { success: false, error: `Unknown source type: ${dataSource.source_type}` };
}

/**
 * Sync a metric that uses a data source (new model)
 */
export async function syncDataSourceMetric(metric: DataSourceMetric): Promise<SyncResult> {
  const supabase = createAdminClient();

  // Get the data source
  const { data: dataSource, error: dsError } = await supabase
    .from("data_sources")
    .select("*")
    .eq("id", metric.data_source_id)
    .single();

  if (dsError || !dataSource) {
    return { success: false, error: "Data source not found" };
  }

  // Log sync start
  const { data: logEntry } = await supabase
    .from("sync_logs")
    .insert({
      metric_id: metric.id,
      status: "running",
    })
    .select()
    .single();

  const logId = logEntry?.id;

  try {
    const windows: TimeWindow[] =
      metric.metric_type === "multi_window"
        ? (metric.time_windows as TimeWindow[]) || []
        : [metric.time_window as TimeWindow];

    let totalRecordsProcessed = 0;
    const errors: string[] = [];

    // Sync each window
    for (const window of windows) {
      const result = await fetchDataSourceValue(dataSource, window);

      if (result.success && result.value !== undefined) {
        // Record the value with the time window
        await supabase.from("metric_values").insert({
          metric_id: metric.id,
          value: result.value,
          time_window: window,
          source: dataSource.source_type,
          notes: `Auto-synced from ${dataSource.source_type} for ${window}`,
        });

        totalRecordsProcessed += result.records_processed || 1;
      } else {
        errors.push(`${window}: ${result.error}`);
      }
    }

    // Check if all windows succeeded
    const allSucceeded = errors.length === 0;

    // Update metric last_sync_at
    await supabase
      .from("metrics")
      .update({
        last_sync_at: new Date().toISOString(),
        sync_error: allSucceeded ? null : errors.join("; "),
      })
      .eq("id", metric.id);

    // Update sync log
    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          status: allSucceeded ? "success" : "error",
          records_processed: totalRecordsProcessed,
          error_message: allSucceeded ? null : errors.join("; "),
        })
        .eq("id", logId);
    }

    return {
      success: allSucceeded,
      value: undefined, // Multi-value sync
      records_processed: totalRecordsProcessed,
      error: allSucceeded ? undefined : errors.join("; "),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update sync log with error
    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          status: "error",
          error_message: errorMessage,
        })
        .eq("id", logId);
    }

    // Update metric with error
    await supabase
      .from("metrics")
      .update({
        sync_error: errorMessage,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", metric.id);

    return { success: false, error: errorMessage };
  }
}

/**
 * Sync a single metric from its external source (legacy model)
 */
export async function syncMetric(metric: LegacyMetric): Promise<SyncResult> {
  const supabase = createAdminClient();

  // Log sync start
  const { data: logEntry } = await supabase
    .from("sync_logs")
    .insert({
      metric_id: metric.id,
      status: "running",
    })
    .select()
    .single();

  const logId = logEntry?.id;

  try {
    let result: SyncResult;

    switch (metric.source_type) {
      case "hubspot":
        if (!metric.source_config) {
          throw new Error("HubSpot metric missing source_config");
        }
        result = await fetchHubSpotMetric(metric.source_config as unknown as HubSpotMetricConfig);
        break;

      case "bigquery":
        if (!metric.source_config) {
          throw new Error("BigQuery metric missing source_config");
        }
        result = await fetchBigQueryMetric(metric.source_config as unknown as BigQueryMetricConfig);
        break;

      default:
        throw new Error(`Unsupported source type: ${metric.source_type}`);
    }

    if (!result.success) {
      // Update sync log with error
      if (logId) {
        await supabase
          .from("sync_logs")
          .update({
            completed_at: new Date().toISOString(),
            status: "error",
            error_message: result.error,
          })
          .eq("id", logId);
      }

      // Update metric with error
      await supabase
        .from("metrics")
        .update({
          sync_error: result.error,
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", metric.id);

      return result;
    }

    // Record the new value
    await supabase.from("metric_values").insert({
      metric_id: metric.id,
      value: result.value,
      source: metric.source_type,
      notes: `Auto-synced from ${metric.source_type}`,
    });

    // Update metric last_sync_at and clear error
    await supabase
      .from("metrics")
      .update({
        last_sync_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq("id", metric.id);

    // Update sync log with success
    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          status: "success",
          records_processed: result.records_processed || 1,
          details: result.details,
        })
        .eq("id", logId);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update sync log with error
    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          status: "error",
          error_message: errorMessage,
        })
        .eq("id", logId);
    }

    // Update metric with error
    await supabase
      .from("metrics")
      .update({
        sync_error: errorMessage,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", metric.id);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sync all metrics with external sources
 */
export async function syncAllMetrics(): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{ metric_id: string; metric_name: string; success: boolean; error?: string }>;
}> {
  const supabase = createAdminClient();

  const results: Array<{
    metric_id: string;
    metric_name: string;
    success: boolean;
    error?: string;
  }> = [];

  let succeeded = 0;
  let failed = 0;

  // 1. Sync legacy metrics (source_type based)
  const { data: legacyMetrics } = await supabase
    .from("metrics")
    .select("id, name, source_type, source_config, owner_id")
    .in("source_type", ["hubspot", "bigquery"])
    .eq("metric_type", "manual") // Legacy metrics
    .eq("sync_enabled", true)
    .eq("is_active", true);

  if (legacyMetrics) {
    for (const metric of legacyMetrics) {
      const result = await syncMetric(metric);
      results.push({
        metric_id: metric.id,
        metric_name: metric.name,
        success: result.success,
        error: result.error,
      });
      if (result.success) succeeded++;
      else failed++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // 2. Sync data source-based metrics
  const { data: dataSourceMetrics } = await supabase
    .from("metrics")
    .select("id, name, metric_type, data_source_id, time_window, time_windows, owner_id")
    .in("metric_type", ["single_window", "multi_window"])
    .eq("sync_enabled", true)
    .eq("is_active", true)
    .not("data_source_id", "is", null);

  if (dataSourceMetrics) {
    for (const metric of dataSourceMetrics) {
      const result = await syncDataSourceMetric(metric as DataSourceMetric);
      results.push({
        metric_id: metric.id,
        metric_name: metric.name,
        success: result.success,
        error: result.error,
      });
      if (result.success) succeeded++;
      else failed++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // 3. Sync calculated metrics (sync last since they may depend on other metrics)
  const { data: calculatedMetrics } = await supabase
    .from("metrics")
    .select("id, name, formula, formula_references")
    .eq("metric_type", "calculated")
    .eq("sync_enabled", true)
    .eq("is_active", true)
    .not("formula", "is", null);

  if (calculatedMetrics) {
    for (const metric of calculatedMetrics) {
      const result = await syncCalculatedMetric({
        id: metric.id,
        name: metric.name,
        formula: metric.formula!,
        formula_references: metric.formula_references || [],
      });
      results.push({
        metric_id: metric.id,
        metric_name: metric.name,
        success: result.success,
        error: result.error,
      });
      if (result.success) succeeded++;
      else failed++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return {
    total: results.length,
    succeeded,
    failed,
    results,
  };
}

/**
 * Get sync status for all external metrics
 */
export async function getSyncStatus(): Promise<{
  metrics: Array<{
    id: string;
    name: string;
    source_type: string;
    metric_type: string;
    last_sync_at: string | null;
    sync_error: string | null;
    sync_enabled: boolean;
  }>;
  lastFullSync: string | null;
}> {
  const supabase = createAdminClient();

  // Get legacy metrics
  const { data: legacyMetrics } = await supabase
    .from("metrics")
    .select("id, name, source_type, metric_type, last_sync_at, sync_error, sync_enabled")
    .in("source_type", ["hubspot", "bigquery"])
    .eq("is_active", true);

  // Get data source metrics
  const { data: dataSourceMetrics } = await supabase
    .from("metrics")
    .select("id, name, source_type, metric_type, last_sync_at, sync_error, sync_enabled")
    .in("metric_type", ["single_window", "multi_window"])
    .eq("is_active", true);

  // Get calculated metrics
  const { data: calculatedMetrics } = await supabase
    .from("metrics")
    .select("id, name, source_type, metric_type, last_sync_at, sync_error, sync_enabled")
    .eq("metric_type", "calculated")
    .eq("is_active", true);

  // Combine and deduplicate
  const allMetrics = [...(legacyMetrics || []), ...(dataSourceMetrics || []), ...(calculatedMetrics || [])];
  const uniqueMetrics = allMetrics.filter(
    (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i
  );

  // Get the most recent successful sync
  const { data: lastSync } = await supabase
    .from("sync_logs")
    .select("completed_at")
    .eq("status", "success")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  return {
    metrics: uniqueMetrics.sort((a, b) => a.name.localeCompare(b.name)),
    lastFullSync: lastSync?.completed_at || null,
  };
}
