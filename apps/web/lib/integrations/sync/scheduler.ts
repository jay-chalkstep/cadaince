/**
 * Inngest Job Definitions for Metric Sync
 *
 * These functions define the background jobs for syncing external metrics.
 * To use these, you need to:
 * 1. Install inngest: npm install inngest
 * 2. Set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY env vars
 * 3. Create an Inngest client and serve these functions
 *
 * For now, these can also be triggered manually via API routes.
 */

import { syncAllMetrics, syncMetric } from "./processor";
import { detectAnomalies } from "./anomaly";
import { createAdminClient } from "@/lib/supabase/server";

// Types for Inngest-like job definitions
interface JobContext {
  event?: {
    data: Record<string, unknown>;
  };
}

interface JobResult {
  synced?: number;
  succeeded?: number;
  failed?: number;
  anomalies?: number;
  success?: boolean;
  error?: string;
}

/**
 * Scheduled metric sync - designed to run every 15 minutes
 * Can be called directly or via Inngest cron
 */
export async function scheduledMetricSync(): Promise<JobResult> {
  console.log("Starting scheduled metric sync...");

  try {
    // Sync all external metrics
    const syncResult = await syncAllMetrics();

    console.log(
      `Sync complete: ${syncResult.succeeded}/${syncResult.total} succeeded`
    );

    // Run anomaly detection after sync
    const anomalies = await detectAnomalies();

    console.log(`Anomaly detection complete: ${anomalies.length} anomalies found`);

    return {
      synced: syncResult.total,
      succeeded: syncResult.succeeded,
      failed: syncResult.failed,
      anomalies: anomalies.length,
    };
  } catch (error) {
    console.error("Scheduled sync failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Manual sync trigger for a single metric
 */
export async function manualMetricSync(context: JobContext): Promise<JobResult> {
  const metricId = context.event?.data?.metricId as string;

  if (!metricId) {
    return { success: false, error: "metricId is required" };
  }

  console.log(`Starting manual sync for metric ${metricId}...`);

  try {
    const supabase = createAdminClient();

    // Get the metric
    const { data: metric, error } = await supabase
      .from("metrics")
      .select("id, name, source_type, source_config, owner_id")
      .eq("id", metricId)
      .single();

    if (error || !metric) {
      return { success: false, error: "Metric not found" };
    }

    if (metric.source_type === "manual") {
      return { success: false, error: "Cannot sync manual metrics" };
    }

    // Sync the metric
    const result = await syncMetric(metric);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Run anomaly detection for this metric
    const anomalies = await detectAnomalies();
    const metricAnomalies = anomalies.filter((a) => a.metric_id === metricId);

    return {
      success: true,
      anomalies: metricAnomalies.length,
    };
  } catch (error) {
    console.error(`Manual sync failed for metric ${metricId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Anomaly detection job - can run independently
 */
export async function runAnomalyDetection(): Promise<JobResult> {
  console.log("Starting anomaly detection...");

  try {
    const anomalies = await detectAnomalies();

    console.log(`Found ${anomalies.length} anomalies`);

    // Log critical anomalies
    const critical = anomalies.filter((a) => a.severity === "critical");
    if (critical.length > 0) {
      console.log(`CRITICAL anomalies: ${critical.map((a) => a.message).join("; ")}`);
    }

    return {
      success: true,
      anomalies: anomalies.length,
    };
  } catch (error) {
    console.error("Anomaly detection failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Example Inngest function definitions (for reference)
 *
 * If using Inngest, create a client and register these:
 *
 * ```typescript
 * import { Inngest } from 'inngest';
 *
 * const inngest = new Inngest({ id: 'cadence' });
 *
 * export const syncMetricsJob = inngest.createFunction(
 *   { id: 'sync-external-metrics', name: 'Sync External Metrics' },
 *   { cron: '*​/15 * * * *' }, // Every 15 minutes
 *   async ({ step }) => {
 *     return await step.run('sync', scheduledMetricSync);
 *   }
 * );
 *
 * export const manualSyncJob = inngest.createFunction(
 *   { id: 'manual-metric-sync', name: 'Manual Metric Sync' },
 *   { event: 'metric/sync.requested' },
 *   async ({ event, step }) => {
 *     return await step.run('sync', () => manualMetricSync({ event }));
 *   }
 * );
 * ```
 */
