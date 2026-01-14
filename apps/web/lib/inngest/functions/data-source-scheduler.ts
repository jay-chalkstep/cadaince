/**
 * Generic Data Source Sync Scheduler
 *
 * A single Inngest cron job that handles scheduling for all data sources.
 * Runs every 5 minutes and syncs any data sources that are due.
 */

import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/server";
import { syncDataSource } from "@/lib/integrations/sync-v2/engine";
import type { SyncFrequency } from "@/lib/integrations/oauth/types";

/**
 * Calculate the next sync time based on frequency
 */
function calculateNextSyncTime(frequency: SyncFrequency): Date | null {
  const now = new Date();

  switch (frequency) {
    case "5min":
      return new Date(now.getTime() + 5 * 60 * 1000);
    case "15min":
      return new Date(now.getTime() + 15 * 60 * 1000);
    case "hourly":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "manual":
      return null; // Manual syncs don't get scheduled
    default:
      return null;
  }
}

/**
 * Scheduled Data Source Sync
 *
 * Runs every 5 minutes and processes all data sources that are due for sync.
 */
export const scheduledDataSourceSync = inngest.createFunction(
  {
    id: "scheduled-data-source-sync",
    name: "Scheduled Data Source Sync",
    retries: 2,
    concurrency: {
      limit: 5, // Process up to 5 data sources concurrently
    },
  },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step, logger }) => {
    const supabase = createAdminClient();

    // Find data sources that are due for sync
    const dataSources = await step.run("find-due-sources", async () => {
      const { data, error } = await supabase
        .from("data_sources_v2")
        .select(
          `
          id,
          name,
          organization_id,
          sync_frequency,
          destination_type,
          next_scheduled_sync_at
        `
        )
        .eq("is_active", true)
        .neq("sync_frequency", "manual")
        .or("next_scheduled_sync_at.is.null,next_scheduled_sync_at.lte.now()")
        .order("next_scheduled_sync_at", { ascending: true, nullsFirst: true })
        .limit(50); // Process up to 50 at a time

      if (error) {
        logger.error("Failed to fetch due data sources", { error });
        return [];
      }

      return data || [];
    });

    if (dataSources.length === 0) {
      return { success: true, message: "No data sources due for sync" };
    }

    logger.info(`Found ${dataSources.length} data sources due for sync`);

    // Process each data source
    const results: Array<{
      id: string;
      name: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const ds of dataSources) {
      const result = await step.run(
        `sync-${ds.id.slice(0, 8)}`,
        async () => {
          try {
            // Run the sync
            const syncResult = await syncDataSource(ds.id, "scheduled");

            // Calculate and update next sync time
            const nextSync = calculateNextSyncTime(
              ds.sync_frequency as SyncFrequency
            );

            await supabase
              .from("data_sources_v2")
              .update({
                next_scheduled_sync_at: nextSync?.toISOString() || null,
              })
              .eq("id", ds.id);

            return {
              id: ds.id,
              name: ds.name,
              success: syncResult.success,
              error: syncResult.error,
            };
          } catch (error) {
            return {
              id: ds.id,
              name: ds.name,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        }
      );

      results.push(result);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.info("Sync batch complete", {
      total: results.length,
      succeeded,
      failed,
    });

    return {
      success: true,
      total: results.length,
      succeeded,
      failed,
      results,
    };
  }
);

// Export all data source scheduler functions
export const dataSourceSchedulerFunctions = [scheduledDataSourceSync];
