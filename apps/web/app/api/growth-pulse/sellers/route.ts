import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SellersListResponse, SellerSummary, OrgBenchmarks } from "@/types/growth-pulse";

// GET /api/growth-pulse/sellers
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
  const sortBy = searchParams.get("sort_by") || "open_pipeline_arr";
  const sortOrder = searchParams.get("sort_order") || "desc";

  try {
    // Fetch org settings to get excluded owners
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single();

    const orgSettings = org?.settings as Record<string, unknown> | null;
    const pulseSettings = orgSettings?.pulse_settings as { growth_pulse_excluded_owners?: string[] } | undefined;
    const excludedOwners = pulseSettings?.growth_pulse_excluded_owners || [];

    // Build seller query with optional exclusion filter
    let sellersQuery = supabase
      .from("vw_seller_pipeline_summary")
      .select("*")
      .eq("organization_id", organizationId);

    if (excludedOwners.length > 0) {
      sellersQuery = sellersQuery.not("owner_id", "in", `(${excludedOwners.join(",")})`);
    }

    sellersQuery = sellersQuery.order(sortBy, { ascending: sortOrder === "asc" });

    // Fetch seller summaries and benchmarks in parallel
    const [sellersResult, benchmarksResult] = await Promise.all([
      sellersQuery,

      supabase
        .from("vw_org_benchmarks")
        .select("*")
        .eq("organization_id", organizationId)
        .single(),
    ]);

    if (sellersResult.error) {
      console.error("Error fetching sellers:", sellersResult.error);
      return NextResponse.json({ error: "Failed to fetch sellers" }, { status: 500 });
    }

    // Format seller summaries
    const sellers: SellerSummary[] = (sellersResult.data || []).map((row) => ({
      ownerId: row.owner_id,
      ownerName: row.owner_name || "Unknown",
      ownerEmail: row.owner_email || null,
      firstName: row.first_name || null,
      lastName: row.last_name || null,
      openPipelineArr: row.open_pipeline_arr || 0,
      openPipelineAmount: row.open_pipeline_amount || 0,
      openDealCount: row.open_deal_count || 0,
      closedWonQtdArr: row.closed_won_qtd_arr || 0,
      closedWonQtdCount: row.closed_won_qtd_count || 0,
      closedWonArr: row.closed_won_arr || 0,
      closedWonCount: row.closed_won_count || 0,
      closedLostCount: row.closed_lost_count || 0,
      avgOpenDealSize: row.avg_open_deal_size || 0,
      avgDealAgeDays: row.avg_deal_age_days || null,
    }));

    // Format benchmarks
    const benchmarksData = benchmarksResult.data;
    const benchmarks: OrgBenchmarks = {
      avgOpenPipeline: benchmarksData?.avg_open_pipeline || 0,
      avgClosedWonQtd: benchmarksData?.avg_closed_won_qtd || 0,
      avgOpenDeals: benchmarksData?.avg_open_deals || 0,
      avgDealAge: benchmarksData?.avg_deal_age || null,
      avgDealSize: benchmarksData?.avg_deal_size || 0,
      leaderClosedWonQtd: benchmarksData?.leader_closed_won_qtd || 0,
      leaderOpenPipeline: benchmarksData?.leader_open_pipeline || 0,
      leaderOpenDeals: benchmarksData?.leader_open_deals || 0,
      totalOpenPipeline: benchmarksData?.total_open_pipeline || 0,
      totalClosedWonQtd: benchmarksData?.total_closed_won_qtd || 0,
      sellerCount: benchmarksData?.seller_count || 0,
    };

    const response: SellersListResponse = {
      sellers,
      benchmarks,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching growth pulse sellers:", error);
    return NextResponse.json({ error: "Failed to fetch sellers" }, { status: 500 });
  }
}
