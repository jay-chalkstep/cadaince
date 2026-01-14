/**
 * Growth Pulse Destination Handler
 *
 * Handles the `growth_pulse` destination type for data_sources_v2.
 * Routes to appropriate sync functions based on entity_type.
 */

import { syncGrowthPulseOwners } from "../../hubspot/sync-growth-pulse-owners";
import { syncHubSpotDeals } from "../../hubspot/sync-deals";
import { syncHubSpotActivities } from "../../hubspot/sync-activities";
import type { DataSource } from "../../oauth/types";

export interface GrowthPulseConfig {
  entity_type: "owners" | "deals" | "activities";
  track_stage_history?: boolean;
}

export interface GrowthPulseSyncResult {
  success: boolean;
  records_processed: number;
  signals_created: number;
  error?: string;
  details?: {
    records_fetched?: number;
    records_created?: number;
    records_updated?: number;
    stage_changes_detected?: number;
  };
}

/**
 * Process a Growth Pulse data source sync
 *
 * Unlike other destination types that process fetch results,
 * Growth Pulse handlers do their own fetching internally since
 * they have specialized sync logic (e.g., stage history tracking).
 */
export async function processToGrowthPulse(
  dataSource: DataSource,
  organizationId: string
): Promise<GrowthPulseSyncResult> {
  const config = dataSource.destination_config as unknown as GrowthPulseConfig;

  if (!config?.entity_type) {
    return {
      success: false,
      records_processed: 0,
      signals_created: 0,
      error: "Missing entity_type in destination_config",
    };
  }

  switch (config.entity_type) {
    case "owners":
      return processOwners(organizationId);
    case "deals":
      return processDeals(organizationId);
    case "activities":
      return processActivities(organizationId);
    default:
      return {
        success: false,
        records_processed: 0,
        signals_created: 0,
        error: `Unknown Growth Pulse entity type: ${config.entity_type}`,
      };
  }
}

/**
 * Process HubSpot owners sync
 */
async function processOwners(
  organizationId: string
): Promise<GrowthPulseSyncResult> {
  const result = await syncGrowthPulseOwners(organizationId);

  return {
    success: result.success,
    records_processed: result.count || 0,
    signals_created: 0,
    error: result.error,
    details: {
      records_fetched: result.count || 0,
      records_created: result.count || 0,
    },
  };
}

/**
 * Process HubSpot deals sync
 */
async function processDeals(
  organizationId: string
): Promise<GrowthPulseSyncResult> {
  const result = await syncHubSpotDeals(organizationId);

  return {
    success: result.success,
    records_processed:
      (result.recordsCreated || 0) + (result.recordsUpdated || 0),
    signals_created: 0,
    error: result.error,
    details: {
      records_fetched: result.recordsFetched,
      records_created: result.recordsCreated,
      records_updated: result.recordsUpdated,
      stage_changes_detected: result.stageChangesDetected,
    },
  };
}

/**
 * Process HubSpot activities sync
 */
async function processActivities(
  organizationId: string
): Promise<GrowthPulseSyncResult> {
  const result = await syncHubSpotActivities(organizationId);

  return {
    success: result.success,
    records_processed: result.recordsCreated || 0,
    signals_created: 0,
    error: result.error,
    details: {
      records_fetched: result.recordsFetched,
      records_created: result.recordsCreated,
    },
  };
}
