/**
 * HubSpot Owner Sync
 *
 * Fetches HubSpot owners and stores them in integration_records
 * so we can display owner names instead of IDs in Support Pulse.
 */

import { HubSpotClient } from "../providers/hubspot/client";
import { createAdminClient } from "@/lib/supabase/server";

export interface SyncOwnersResult {
  success: boolean;
  count?: number;
  error?: string;
}

/**
 * Sync HubSpot owners to integration_records table
 */
export async function syncHubSpotOwners(
  organizationId: string
): Promise<SyncOwnersResult> {
  try {
    console.log("[syncHubSpotOwners] Starting sync for org:", organizationId);

    // Get HubSpot client for this organization
    const client = await HubSpotClient.forOrganization(organizationId);
    if (!client) {
      console.log("[syncHubSpotOwners] No HubSpot client found");
      return {
        success: false,
        error: "No HubSpot integration found for this organization",
      };
    }

    console.log("[syncHubSpotOwners] Client created, fetching owners...");

    // Fetch all owners from HubSpot using the client method
    let owners;
    try {
      owners = await client.fetchOwners();
      console.log("[syncHubSpotOwners] Fetched owners count:", owners.length);
      if (owners.length > 0) {
        console.log("[syncHubSpotOwners] Sample owner:", JSON.stringify(owners[0]));
      }
    } catch (fetchError) {
      console.error("[syncHubSpotOwners] Error fetching owners from HubSpot:", fetchError);
      return {
        success: false,
        error: `Failed to fetch owners from HubSpot: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`,
      };
    }

    if (owners.length === 0) {
      console.log("[syncHubSpotOwners] No owners returned from HubSpot");
      return {
        success: true,
        count: 0,
      };
    }

    const supabase = createAdminClient();

    // Find the HubSpot integration for this org
    const { data: integration, error: integrationError } = await supabase
      .from("integrations_v2")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("provider", "hubspot")
      .eq("status", "active")
      .single();

    console.log("[syncHubSpotOwners] Integration lookup:", { integration, error: integrationError });

    if (!integration) {
      return {
        success: false,
        error: "No active HubSpot integration found",
      };
    }

    // Find or create a data source for owners
    let { data: dataSource, error: dataSourceError } = await supabase
      .from("data_sources_v2")
      .select("id")
      .eq("integration_id", integration.id)
      .eq("source_type", "owners")
      .single();

    console.log("[syncHubSpotOwners] Existing data source lookup:", { dataSource, error: dataSourceError });

    if (!dataSource) {
      // Create a data source for owners
      console.log("[syncHubSpotOwners] Creating new data source...");
      const { data: newDataSource, error: createError } = await supabase
        .from("data_sources_v2")
        .insert({
          organization_id: organizationId,
          integration_id: integration.id,
          name: "HubSpot Owners",
          description: "HubSpot user/owner records for name lookups",
          source_type: "owners",
          query_config: { object: "owners" },
          destination_type: "raw_records",
          destination_config: {},
          is_active: true,
        })
        .select("id")
        .single();

      console.log("[syncHubSpotOwners] Data source create result:", { newDataSource, error: createError });

      if (createError) {
        console.error("Failed to create owners data source:", createError);
        return {
          success: false,
          error: "Failed to create owners data source",
        };
      }
      dataSource = newDataSource;
    }

    // Prepare records for upsert
    const records = owners.map((owner) => ({
      organization_id: organizationId,
      data_source_id: dataSource!.id,
      external_id: owner.id,
      object_type: "owners",
      properties: {
        id: owner.id,
        email: owner.email,
        firstName: owner.firstName,
        lastName: owner.lastName,
        userId: owner.userId?.toString() || null,
        teams: owner.teams || [],
      },
      external_created_at: owner.createdAt,
      external_updated_at: owner.updatedAt,
      synced_at: new Date().toISOString(),
    }));

    // Upsert in batches
    const batchSize = 100;
    let upsertedCount = 0;

    console.log("[syncHubSpotOwners] Prepared records for upsert:", records.length);
    if (records.length > 0) {
      console.log("[syncHubSpotOwners] Sample record:", JSON.stringify(records[0]));
    }

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.log(`[syncHubSpotOwners] Upserting batch ${i / batchSize + 1}, size: ${batch.length}`);

      const { error } = await supabase
        .from("integration_records")
        .upsert(batch, {
          onConflict: "data_source_id,external_id",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("[syncHubSpotOwners] Failed to upsert owner records:", error);
        return {
          success: false,
          error: `Failed to save owners: ${error.message}`,
        };
      }

      upsertedCount += batch.length;
      console.log(`[syncHubSpotOwners] Batch upserted successfully, total: ${upsertedCount}`);
    }

    return {
      success: true,
      count: upsertedCount,
    };
  } catch (error) {
    console.error("Error syncing HubSpot owners:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
    .from("integration_records")
    .select("external_id, properties")
    .eq("organization_id", organizationId)
    .eq("object_type", "owners")
    .in("external_id", ownerIds);

  if (error) {
    console.error("Failed to fetch owner records:", error);
    return new Map();
  }

  const namesMap = new Map<string, string>();

  for (const owner of owners || []) {
    const props = owner.properties as { firstName?: string; lastName?: string };
    const firstName = props.firstName || "";
    const lastName = props.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName) {
      namesMap.set(owner.external_id, fullName);
    }
  }

  return namesMap;
}
