import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { syncDataSource } from "@/lib/integrations/sync-v2/engine";

type SyncType = "owners" | "deals" | "activities" | "full";

// Entity type order for syncing (owners must come first for name lookups)
const ENTITY_ORDER: Array<"owners" | "deals" | "activities"> = [
  "owners",
  "deals",
  "activities",
];

// POST /api/growth-pulse/sync
// Trigger a manual sync of HubSpot data via data_sources_v2
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's organization and check admin access
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  // Only admins can trigger syncs
  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const organizationId = profile.organization_id;

  // Parse request body
  let syncType: SyncType = "full";

  try {
    const body = await req.json();
    syncType = body.sync_type || "full";
  } catch {
    // Default to full sync if no body provided
  }

  // Validate sync type
  if (!["owners", "deals", "activities", "full"].includes(syncType)) {
    return NextResponse.json({ error: "Invalid sync type" }, { status: 400 });
  }

  try {
    // Find Growth Pulse data sources for this org
    const { data: dataSources, error: dsError } = await supabase
      .from("data_sources_v2")
      .select("id, name, destination_config, source_type")
      .eq("organization_id", organizationId)
      .eq("destination_type", "growth_pulse")
      .eq("is_active", true);

    if (dsError) {
      console.error("Error fetching Growth Pulse data sources:", dsError);
      return NextResponse.json(
        { error: "Failed to fetch data sources" },
        { status: 500 }
      );
    }

    if (!dataSources || dataSources.length === 0) {
      return NextResponse.json(
        {
          error:
            "No Growth Pulse data sources configured. Please ensure HubSpot is connected.",
        },
        { status: 404 }
      );
    }

    // Build a map of entity_type to data source
    const dataSourceMap = new Map<
      string,
      { id: string; name: string; source_type: string }
    >();
    for (const ds of dataSources) {
      const config = ds.destination_config as { entity_type?: string };
      if (config?.entity_type) {
        dataSourceMap.set(config.entity_type, {
          id: ds.id,
          name: ds.name,
          source_type: ds.source_type,
        });
      }
    }

    // Determine which entity types to sync
    const entitiesToSync =
      syncType === "full"
        ? ENTITY_ORDER
        : ENTITY_ORDER.filter((e) => e === syncType);

    const results: Record<
      string,
      {
        success: boolean;
        records_fetched?: number;
        records_processed?: number;
        error?: string;
      }
    > = {};

    // Sync in order
    for (const entityType of entitiesToSync) {
      const ds = dataSourceMap.get(entityType);
      if (!ds) {
        results[entityType] = {
          success: false,
          error: `No data source configured for ${entityType}`,
        };
        continue;
      }

      try {
        const result = await syncDataSource(ds.id, "manual");
        results[entityType] = {
          success: result.success,
          records_fetched: result.records_fetched,
          records_processed: result.records_processed,
          error: result.error,
        };
      } catch (error) {
        results[entityType] = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // Check if all syncs were successful
    const allSuccess = Object.values(results).every((r) => r.success);

    return NextResponse.json({
      success: allSuccess,
      syncType,
      results,
    });
  } catch (error) {
    console.error("Error running growth pulse sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/growth-pulse/sync
// Get sync status and history from data_sources_v2 system
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  const organizationId = profile.organization_id;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

  try {
    // Fetch Growth Pulse data sources with their sync status
    const { data: dataSources, error: dsError } = await supabase
      .from("data_sources_v2")
      .select(
        `
        id,
        name,
        source_type,
        destination_config,
        last_sync_at,
        last_sync_status,
        last_sync_error,
        last_sync_records_count,
        next_scheduled_sync_at,
        sync_frequency
      `
      )
      .eq("organization_id", organizationId)
      .eq("destination_type", "growth_pulse");

    if (dsError) {
      console.error("Error fetching data sources:", dsError);
      return NextResponse.json(
        { error: "Failed to fetch data sources" },
        { status: 500 }
      );
    }

    // Fetch recent sync history from data_source_syncs
    const dataSourceIds = dataSources?.map((ds) => ds.id) || [];

    let recentSyncs: Array<{
      id: string;
      data_source_id: string;
      started_at: string;
      completed_at: string | null;
      status: string;
      records_fetched: number;
      records_processed: number;
      error_message: string | null;
      triggered_by: string;
    }> = [];

    if (dataSourceIds.length > 0) {
      const { data: syncs, error: syncError } = await supabase
        .from("data_source_syncs")
        .select(
          `
          id,
          data_source_id,
          started_at,
          completed_at,
          status,
          records_fetched,
          records_processed,
          error_message,
          triggered_by
        `
        )
        .in("data_source_id", dataSourceIds)
        .order("started_at", { ascending: false })
        .limit(limit);

      if (syncError) {
        console.error("Error fetching sync history:", syncError);
      } else {
        recentSyncs = syncs || [];
      }
    }

    // Build response with last sync status by entity type
    const lastSyncByType: Record<
      string,
      {
        dataSourceId: string;
        name: string;
        lastSyncAt: string | null;
        lastSyncStatus: string | null;
        lastSyncError: string | null;
        recordsFetched: number | null;
        nextScheduledSyncAt: string | null;
        syncFrequency: string;
      }
    > = {};

    for (const ds of dataSources || []) {
      const config = ds.destination_config as { entity_type?: string };
      const entityType = config?.entity_type;
      if (entityType) {
        lastSyncByType[entityType] = {
          dataSourceId: ds.id,
          name: ds.name,
          lastSyncAt: ds.last_sync_at,
          lastSyncStatus: ds.last_sync_status,
          lastSyncError: ds.last_sync_error,
          recordsFetched: ds.last_sync_records_count,
          nextScheduledSyncAt: ds.next_scheduled_sync_at,
          syncFrequency: ds.sync_frequency,
        };
      }
    }

    // Add logs mapped to entity types for backward compatibility
    const logs = recentSyncs.map((sync) => {
      const ds = dataSources?.find((d) => d.id === sync.data_source_id);
      const config = ds?.destination_config as { entity_type?: string };
      return {
        id: sync.id,
        sync_type: config?.entity_type || "unknown",
        status: sync.status,
        started_at: sync.started_at,
        completed_at: sync.completed_at,
        records_fetched: sync.records_fetched,
        records_processed: sync.records_processed,
        error_message: sync.error_message,
        triggered_by: sync.triggered_by,
      };
    });

    return NextResponse.json({
      logs,
      lastSyncByType,
      dataSources: dataSources || [],
    });
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync status" },
      { status: 500 }
    );
  }
}
