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
    // Get HubSpot client for this organization
    const client = await HubSpotClient.forOrganization(organizationId);
    if (!client) {
      return {
        success: false,
        error: "No HubSpot integration found for this organization",
      };
    }

    // Fetch all owners from HubSpot using the client method
    const owners = await client.fetchOwners();

    if (owners.length === 0) {
      return {
        success: true,
        count: 0,
      };
    }

    const supabase = createAdminClient();

    // Find the HubSpot integration for this org
    const { data: integration } = await supabase
      .from("integrations_v2")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("provider", "hubspot")
      .eq("status", "active")
      .single();

    if (!integration) {
      return {
        success: false,
        error: "No active HubSpot integration found",
      };
    }

    // Find or create a data source for owners
    let { data: dataSource } = await supabase
      .from("data_sources_v2")
      .select("id")
      .eq("integration_id", integration.id)
      .eq("source_type", "owners")
      .single();

    if (!dataSource) {
      // Create a data source for owners
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

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from("integration_records")
        .upsert(batch, {
          onConflict: "data_source_id,external_id",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("Failed to upsert owner records:", error);
        return {
          success: false,
          error: `Failed to save owners: ${error.message}`,
        };
      }

      upsertedCount += batch.length;
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
