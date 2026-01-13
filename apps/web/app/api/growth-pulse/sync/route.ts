import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { syncGrowthPulseOwners } from "@/lib/integrations/hubspot/sync-growth-pulse-owners";
import { syncHubSpotDeals } from "@/lib/integrations/hubspot/sync-deals";
import { syncHubSpotActivities } from "@/lib/integrations/hubspot/sync-activities";

type SyncType = "owners" | "deals" | "activities" | "full";

// POST /api/growth-pulse/sync
// Trigger a manual sync of HubSpot data
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
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admins can trigger syncs
  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const organizationId = profile.organization_id;

  // Parse request body
  let syncType: SyncType = "full";
  let useBackground = false;

  try {
    const body = await req.json();
    syncType = body.sync_type || "full";
    useBackground = body.background === true;
  } catch {
    // Default to full sync if no body provided
  }

  // Validate sync type
  if (!["owners", "deals", "activities", "full"].includes(syncType)) {
    return NextResponse.json({ error: "Invalid sync type" }, { status: 400 });
  }

  try {
    if (useBackground) {
      // Trigger background job via Inngest
      await inngest.send({
        name: "growth-pulse/sync-requested",
        data: {
          organization_id: organizationId,
          sync_type: syncType,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Sync job queued",
        syncType,
        background: true,
      });
    }

    // Run sync synchronously
    const results: {
      owners?: { success: boolean; count?: number; error?: string };
      deals?: { success: boolean; recordsFetched?: number; stageChanges?: number; error?: string };
      activities?: { success: boolean; recordsFetched?: number; error?: string };
    } = {};

    // Determine what to sync
    const syncOwners = syncType === "owners" || syncType === "full";
    const syncDeals = syncType === "deals" || syncType === "full";
    const syncActivities = syncType === "activities" || syncType === "full";

    // Sync owners first (deals depend on owner names)
    if (syncOwners) {
      const result = await syncGrowthPulseOwners(organizationId);
      results.owners = {
        success: result.success,
        count: result.count,
        error: result.error,
      };
    }

    // Sync deals
    if (syncDeals) {
      const result = await syncHubSpotDeals(organizationId);
      results.deals = {
        success: result.success,
        recordsFetched: result.recordsFetched,
        stageChanges: result.stageChangesDetected,
        error: result.error,
      };
    }

    // Sync activities
    if (syncActivities) {
      const result = await syncHubSpotActivities(organizationId);
      results.activities = {
        success: result.success,
        recordsFetched: result.recordsFetched,
        error: result.error,
      };
    }

    // Check if all syncs were successful
    const allSuccess =
      (!results.owners || results.owners.success) &&
      (!results.deals || results.deals.success) &&
      (!results.activities || results.activities.success);

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
// Get sync status and history
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
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const organizationId = profile.organization_id;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const syncType = searchParams.get("sync_type");

  try {
    // Fetch recent sync logs
    let query = supabase
      .from("growth_pulse_sync_log")
      .select("*")
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (syncType) {
      query = query.eq("sync_type", syncType);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error("Error fetching sync logs:", error);
      return NextResponse.json({ error: "Failed to fetch sync logs" }, { status: 500 });
    }

    // Get the last successful sync for each type
    const { data: lastSyncs } = await supabase
      .from("growth_pulse_sync_log")
      .select("sync_type, completed_at, records_fetched")
      .eq("organization_id", organizationId)
      .eq("status", "success")
      .order("completed_at", { ascending: false });

    const lastSyncByType: Record<string, { completedAt: string; recordsFetched: number }> = {};
    for (const sync of lastSyncs || []) {
      if (!lastSyncByType[sync.sync_type]) {
        lastSyncByType[sync.sync_type] = {
          completedAt: sync.completed_at,
          recordsFetched: sync.records_fetched || 0,
        };
      }
    }

    return NextResponse.json({
      logs: logs || [],
      lastSyncByType,
    });
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return NextResponse.json({ error: "Failed to fetch sync status" }, { status: 500 });
  }
}
