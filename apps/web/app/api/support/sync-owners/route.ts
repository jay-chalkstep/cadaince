import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { syncHubSpotOwners } from "@/lib/integrations/hubspot/sync-owners";

// POST /api/support/sync-owners - Sync HubSpot owners
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
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  try {
    const result = await syncHubSpotOwners(profile.organization_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to sync owners" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Successfully synced ${result.count} owners`,
    });
  } catch (error) {
    console.error("Error in sync-owners endpoint:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
