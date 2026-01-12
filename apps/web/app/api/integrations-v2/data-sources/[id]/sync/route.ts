/**
 * POST /api/integrations-v2/data-sources/[id]/sync
 *
 * Manually trigger a sync for a data source.
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { syncDataSource } from "@/lib/integrations/sync-v2";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 403 }
    );
  }

  // Verify data source belongs to org
  const { data: dataSource, error: findError } = await supabase
    .from("data_sources_v2")
    .select("id, name, organization_id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (findError || !dataSource) {
    return NextResponse.json(
      { error: "Data source not found" },
      { status: 404 }
    );
  }

  // Run sync
  const result = await syncDataSource(id, "manual");

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Sync failed",
        details: result.error,
        records_fetched: result.records_fetched,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Synced ${dataSource.name}`,
    records_fetched: result.records_fetched,
    records_processed: result.records_processed,
    signals_created: result.signals_created,
    details: result.details,
  });
}
