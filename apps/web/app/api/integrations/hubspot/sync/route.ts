/**
 * POST /api/integrations/hubspot/sync
 *
 * Convenience endpoint to sync all HubSpot ticket data sources for the current user's org.
 * Uses the existing sync-v2 engine which respects user-selected field configuration.
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { syncDataSource } from "@/lib/integrations/sync-v2";

export async function POST() {
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
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  // Find ticket data sources for this org
  const { data: dataSources, error: dsError } = await supabase
    .from("data_sources_v2")
    .select("id, name, query_config")
    .eq("organization_id", profile.organization_id)
    .eq("is_active", true)
    .or("source_type.eq.tickets,query_config->>object.eq.tickets");

  if (dsError || !dataSources?.length) {
    return NextResponse.json(
      { error: "No ticket data sources found" },
      { status: 404 }
    );
  }

  // Sync each ticket data source
  const results = [];
  let totalRecords = 0;

  for (const ds of dataSources) {
    const result = await syncDataSource(ds.id, "manual");
    results.push({
      data_source_id: ds.id,
      name: ds.name,
      success: result.success,
      records_fetched: result.records_fetched,
      error: result.error,
    });
    if (result.success) {
      totalRecords += result.records_fetched;
    }
  }

  const allSuccess = results.every((r) => r.success);

  return NextResponse.json({
    success: allSuccess,
    count: totalRecords,
    data_sources_synced: results.length,
    results,
  });
}
