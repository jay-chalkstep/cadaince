import { createAdminClient } from "@/lib/supabase/server";
import { fetchHubSpotMetric } from "../hubspot/client";
import { fetchBigQueryMetric } from "../bigquery/client";
import type {
  HubSpotMetricConfig,
  BigQueryMetricConfig,
  SyncResult,
} from "../types";

interface Metric {
  id: string;
  name: string;
  source_type: string;
  source_config: Record<string, unknown> | null;
  owner_id: string;
}

/**
 * Sync a single metric from its external source
 */
export async function syncMetric(metric: Metric): Promise<SyncResult> {
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

  // Get all active metrics with external sources
  const { data: metrics, error } = await supabase
    .from("metrics")
    .select("id, name, source_type, source_config, owner_id")
    .in("source_type", ["hubspot", "bigquery"])
    .eq("sync_enabled", true)
    .eq("is_active", true);

  if (error || !metrics) {
    console.error("Error fetching metrics for sync:", error);
    return { total: 0, succeeded: 0, failed: 0, results: [] };
  }

  const results: Array<{
    metric_id: string;
    metric_name: string;
    success: boolean;
    error?: string;
  }> = [];

  let succeeded = 0;
  let failed = 0;

  // Sync each metric sequentially to avoid rate limits
  for (const metric of metrics) {
    const result = await syncMetric(metric);

    results.push({
      metric_id: metric.id,
      metric_name: metric.name,
      success: result.success,
      error: result.error,
    });

    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }

    // Small delay between syncs to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    total: metrics.length,
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
    last_sync_at: string | null;
    sync_error: string | null;
    sync_enabled: boolean;
  }>;
  lastFullSync: string | null;
}> {
  const supabase = createAdminClient();

  const { data: metrics } = await supabase
    .from("metrics")
    .select("id, name, source_type, last_sync_at, sync_error, sync_enabled")
    .in("source_type", ["hubspot", "bigquery"])
    .eq("is_active", true)
    .order("name");

  // Get the most recent successful sync
  const { data: lastSync } = await supabase
    .from("sync_logs")
    .select("completed_at")
    .eq("status", "success")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  return {
    metrics: metrics || [],
    lastFullSync: lastSync?.completed_at || null,
  };
}
