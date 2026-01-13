/**
 * HubSpot Owner Sync for Growth Pulse
 *
 * Fetches HubSpot owners and stores them in the dedicated hubspot_owners table.
 * This replaces the integration_records-based approach for better performance.
 */

import { HubSpotClient } from "../providers/hubspot/client";
import { createAdminClient } from "@/lib/supabase/server";

export interface SyncOwnersResult {
  success: boolean;
  count?: number;
  error?: string;
  syncLogId?: string;
}

/**
 * Sync HubSpot owners to the hubspot_owners table
 */
export async function syncGrowthPulseOwners(
  organizationId: string
): Promise<SyncOwnersResult> {
  const supabase = createAdminClient();
  let syncLogId: string | undefined;

  try {
    console.log("[syncGrowthPulseOwners] Starting sync for org:", organizationId);

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from("growth_pulse_sync_log")
      .insert({
        organization_id: organizationId,
        sync_type: "owners",
        status: "running",
      })
      .select("id")
      .single();

    if (syncLogError) {
      console.error("[syncGrowthPulseOwners] Failed to create sync log:", syncLogError);
    } else {
      syncLogId = syncLog.id;
    }

    // Get HubSpot client for this organization
    const client = await HubSpotClient.forOrganization(organizationId);
    if (!client) {
      const errorMsg = "No HubSpot integration found for this organization";
      await updateSyncLog(supabase, syncLogId, "error", errorMsg);
      return {
        success: false,
        error: errorMsg,
        syncLogId,
      };
    }

    console.log("[syncGrowthPulseOwners] Fetching owners from HubSpot...");

    // Fetch all owners from HubSpot
    let owners;
    try {
      owners = await client.fetchOwners();
      console.log("[syncGrowthPulseOwners] Fetched owners:", owners.length);
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : "Failed to fetch owners";
      console.error("[syncGrowthPulseOwners] Error fetching owners:", fetchError);
      await updateSyncLog(supabase, syncLogId, "error", errorMsg);
      return {
        success: false,
        error: errorMsg,
        syncLogId,
      };
    }

    if (owners.length === 0) {
      console.log("[syncGrowthPulseOwners] No owners returned from HubSpot");
      await updateSyncLog(supabase, syncLogId, "success", undefined, { records_fetched: 0 });
      return {
        success: true,
        count: 0,
        syncLogId,
      };
    }

    // Prepare records for upsert
    const now = new Date().toISOString();
    const records = owners.map((owner) => ({
      organization_id: organizationId,
      hubspot_owner_id: owner.id,
      email: owner.email || null,
      first_name: owner.firstName || null,
      last_name: owner.lastName || null,
      user_id: owner.userId?.toString() || null,
      teams: owner.teams || [],
      is_active: !owner.archived,
      synced_at: now,
    }));

    // Upsert in batches
    const batchSize = 100;
    let upsertedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.log(`[syncGrowthPulseOwners] Upserting batch ${Math.floor(i / batchSize) + 1}, size: ${batch.length}`);

      const { error } = await supabase
        .from("hubspot_owners")
        .upsert(batch, {
          onConflict: "organization_id,hubspot_owner_id",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("[syncGrowthPulseOwners] Failed to upsert owners:", error);
        throw new Error(`Failed to save owners: ${error.message}`);
      }

      upsertedCount += batch.length;
    }

    console.log("[syncGrowthPulseOwners] Sync complete:", upsertedCount, "owners");

    // Update sync log
    await updateSyncLog(supabase, syncLogId, "success", undefined, {
      records_fetched: upsertedCount,
      records_created: upsertedCount, // For owners, we count all as "created" since it's a full refresh
    });

    return {
      success: true,
      count: upsertedCount,
      syncLogId,
    };
  } catch (error) {
    console.error("[syncGrowthPulseOwners] Error:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await updateSyncLog(supabase, syncLogId, "error", errorMsg);
    return {
      success: false,
      error: errorMsg,
      syncLogId,
    };
  }
}

/**
 * Get owner name by HubSpot owner ID
 */
export async function getOwnerName(
  organizationId: string,
  hubspotOwnerId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: owner } = await supabase
    .from("hubspot_owners")
    .select("first_name, last_name")
    .eq("organization_id", organizationId)
    .eq("hubspot_owner_id", hubspotOwnerId)
    .single();

  if (!owner) return null;

  const firstName = owner.first_name || "";
  const lastName = owner.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || null;
}

/**
 * Get owner names lookup map for a set of owner IDs
 */
export async function getOwnerNamesMap(
  organizationId: string,
  ownerIds: string[]
): Promise<Map<string, string>> {
  if (ownerIds.length === 0) {
    return new Map();
  }

  const supabase = createAdminClient();

  const { data: owners, error } = await supabase
    .from("hubspot_owners")
    .select("hubspot_owner_id, first_name, last_name")
    .eq("organization_id", organizationId)
    .in("hubspot_owner_id", ownerIds);

  if (error) {
    console.error("[getOwnerNamesMap] Failed to fetch owners:", error);
    return new Map();
  }

  const namesMap = new Map<string, string>();

  for (const owner of owners || []) {
    const firstName = owner.first_name || "";
    const lastName = owner.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName) {
      namesMap.set(owner.hubspot_owner_id, fullName);
    }
  }

  return namesMap;
}

/**
 * Update sync log with status and results
 */
async function updateSyncLog(
  supabase: ReturnType<typeof createAdminClient>,
  syncLogId: string | undefined,
  status: "success" | "error",
  errorMessage?: string,
  results?: {
    records_fetched?: number;
    records_created?: number;
  }
) {
  if (!syncLogId) return;

  await supabase
    .from("growth_pulse_sync_log")
    .update({
      status,
      completed_at: new Date().toISOString(),
      error_message: errorMessage || null,
      ...results,
    })
    .eq("id", syncLogId);
}
