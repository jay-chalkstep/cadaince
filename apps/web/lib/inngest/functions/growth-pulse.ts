/**
 * Growth Pulse Inngest Functions
 *
 * @deprecated These functions are being replaced by the generic data source scheduler.
 * The new system uses data_sources_v2 records and the scheduler in data-source-scheduler.ts.
 *
 * MIGRATION STATUS:
 * - New scheduler: apps/web/lib/inngest/functions/data-source-scheduler.ts
 * - New handler: apps/web/lib/integrations/sync-v2/handlers/growth-pulse.ts
 * - Migration: supabase/migrations/048_growth_pulse_to_v2.sql
 *
 * These functions will be removed after the migration is verified (30 days).
 * Until then, both systems may run in parallel - this is safe because:
 * - The sync functions are idempotent (upserts)
 * - Duplicate syncs just refresh the same data
 *
 * Background jobs for syncing HubSpot deal pipeline data:
 * - Owners: Daily at 2am
 * - Deals: Every 15 minutes
 * - Activities: Every 30 minutes
 */

import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/server";
import { syncGrowthPulseOwners } from "../../integrations/hubspot/sync-growth-pulse-owners";
import { syncHubSpotDeals } from "../../integrations/hubspot/sync-deals";
import { syncHubSpotActivities } from "../../integrations/hubspot/sync-activities";

/**
 * Get all organizations with active HubSpot integrations
 */
async function getOrgsWithHubSpot(): Promise<string[]> {
  const supabase = createAdminClient();

  const { data: integrations, error } = await supabase
    .from("integrations_v2")
    .select("organization_id")
    .eq("provider", "hubspot")
    .eq("status", "active");

  if (error) {
    console.error("[getOrgsWithHubSpot] Error:", error);
    return [];
  }

  return integrations?.map((i) => i.organization_id) || [];
}

/**
 * Sync HubSpot owners for all organizations
 * Runs daily at 2:00 AM UTC
 *
 * @deprecated Use data_sources_v2 with sync_frequency: 'daily' instead.
 */
export const syncGrowthPulseOwnersJob = inngest.createFunction(
  {
    id: "growth-pulse-sync-owners",
    retries: 2,
  },
  { cron: "0 2 * * *" }, // Daily at 2am UTC
  async ({ step }) => {
    const organizationIds = await step.run("get-orgs-with-hubspot", getOrgsWithHubSpot);

    if (organizationIds.length === 0) {
      return { success: true, message: "No organizations with HubSpot integration found" };
    }

    const results: Array<{ orgId: string; success: boolean; count?: number; error?: string }> = [];

    for (const orgId of organizationIds) {
      const result = await step.run(`sync-owners-${orgId.slice(0, 8)}`, async () => {
        try {
          const syncResult = await syncGrowthPulseOwners(orgId);
          return {
            orgId,
            success: syncResult.success,
            count: syncResult.count,
            error: syncResult.error,
          };
        } catch (error) {
          return {
            orgId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      results.push(result);
    }

    return {
      success: true,
      organizations: results.length,
      results,
    };
  }
);

/**
 * Sync HubSpot deals for all organizations
 * Runs every 15 minutes
 *
 * @deprecated Use data_sources_v2 with sync_frequency: '15min' instead.
 */
export const syncGrowthPulseDealsJob = inngest.createFunction(
  {
    id: "growth-pulse-sync-deals",
    retries: 3,
  },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step }) => {
    const organizationIds = await step.run("get-orgs-with-hubspot", getOrgsWithHubSpot);

    if (organizationIds.length === 0) {
      return { success: true, message: "No organizations with HubSpot integration found" };
    }

    const results: Array<{
      orgId: string;
      success: boolean;
      recordsFetched?: number;
      stageChanges?: number;
      error?: string;
    }> = [];

    for (const orgId of organizationIds) {
      const result = await step.run(`sync-deals-${orgId.slice(0, 8)}`, async () => {
        try {
          const syncResult = await syncHubSpotDeals(orgId);
          return {
            orgId,
            success: syncResult.success,
            recordsFetched: syncResult.recordsFetched,
            stageChanges: syncResult.stageChangesDetected,
            error: syncResult.error,
          };
        } catch (error) {
          return {
            orgId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      results.push(result);
    }

    return {
      success: true,
      organizations: results.length,
      results,
    };
  }
);

/**
 * Sync HubSpot activities for all organizations
 * Runs every 30 minutes
 *
 * @deprecated Use data_sources_v2 with sync_frequency: 'hourly' instead.
 */
export const syncGrowthPulseActivitiesJob = inngest.createFunction(
  {
    id: "growth-pulse-sync-activities",
    retries: 2,
  },
  { cron: "*/30 * * * *" }, // Every 30 minutes
  async ({ step }) => {
    const organizationIds = await step.run("get-orgs-with-hubspot", getOrgsWithHubSpot);

    if (organizationIds.length === 0) {
      return { success: true, message: "No organizations with HubSpot integration found" };
    }

    const results: Array<{
      orgId: string;
      success: boolean;
      recordsFetched?: number;
      error?: string;
    }> = [];

    for (const orgId of organizationIds) {
      const result = await step.run(`sync-activities-${orgId.slice(0, 8)}`, async () => {
        try {
          const syncResult = await syncHubSpotActivities(orgId);
          return {
            orgId,
            success: syncResult.success,
            recordsFetched: syncResult.recordsFetched,
            error: syncResult.error,
          };
        } catch (error) {
          return {
            orgId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      results.push(result);
    }

    return {
      success: true,
      organizations: results.length,
      results,
    };
  }
);

/**
 * Manual sync trigger for a single organization
 * Triggered by event (from API route)
 *
 * @deprecated Use syncDataSource() from sync-v2/engine.ts instead.
 * The /api/growth-pulse/sync API now calls syncDataSource() directly.
 */
export const manualGrowthPulseSync = inngest.createFunction(
  {
    id: "growth-pulse-manual-sync",
    retries: 2,
    concurrency: { limit: 1, key: "event.data.organization_id" },
  },
  { event: "growth-pulse/sync-requested" },
  async ({ event, step }) => {
    const { organization_id, sync_type } = event.data as {
      organization_id: string;
      sync_type: "owners" | "deals" | "activities" | "full";
    };

    const results: {
      owners?: { success: boolean; count?: number; error?: string };
      deals?: { success: boolean; recordsFetched?: number; stageChanges?: number; error?: string };
      activities?: { success: boolean; recordsFetched?: number; error?: string };
    } = {};

    // Determine what to sync
    const syncOwners = sync_type === "owners" || sync_type === "full";
    const syncDeals = sync_type === "deals" || sync_type === "full";
    const syncActivities = sync_type === "activities" || sync_type === "full";

    // Sync owners first (deals depend on owner names)
    if (syncOwners) {
      results.owners = await step.run("sync-owners", async () => {
        try {
          const result = await syncGrowthPulseOwners(organization_id);
          return {
            success: result.success,
            count: result.count,
            error: result.error,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });
    }

    // Sync deals
    if (syncDeals) {
      results.deals = await step.run("sync-deals", async () => {
        try {
          const result = await syncHubSpotDeals(organization_id);
          return {
            success: result.success,
            recordsFetched: result.recordsFetched,
            stageChanges: result.stageChangesDetected,
            error: result.error,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });
    }

    // Sync activities
    if (syncActivities) {
      results.activities = await step.run("sync-activities", async () => {
        try {
          const result = await syncHubSpotActivities(organization_id);
          return {
            success: result.success,
            recordsFetched: result.recordsFetched,
            error: result.error,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });
    }

    return {
      success: true,
      organization_id,
      sync_type,
      results,
    };
  }
);

/**
 * @deprecated All Growth Pulse functions are deprecated.
 * They will be removed after the data_sources_v2 migration is verified.
 * See data-source-scheduler.ts for the replacement.
 */
export const growthPulseFunctions = [
  syncGrowthPulseOwnersJob,
  syncGrowthPulseDealsJob,
  syncGrowthPulseActivitiesJob,
  manualGrowthPulseSync,
];
