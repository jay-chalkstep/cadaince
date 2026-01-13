import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type {
  GrowthPulseMetricsResponse,
  StageBreakdown,
  ClosedWonTrendItem,
  OrgBenchmarks,
  GrowthPulseMetrics,
} from "@/types/growth-pulse";

// GET /api/growth-pulse/metrics
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
  const days = parseInt(searchParams.get("days") || "90");
  const pipeline = searchParams.get("pipeline");

  try {
    // Fetch from views in parallel
    const [summaryResult, stagesResult, benchmarksResult, trendResult] = await Promise.all([
      // Summary metrics from view (aggregates all sellers)
      supabase
        .from("vw_org_benchmarks")
        .select("*")
        .eq("organization_id", organizationId)
        .single(),

      // Pipeline by stage
      pipeline
        ? supabase
            .from("vw_pipeline_by_stage")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("pipeline", pipeline)
        : supabase
            .from("vw_pipeline_by_stage")
            .select("*")
            .eq("organization_id", organizationId),

      // Org benchmarks for context
      supabase
        .from("vw_org_benchmarks")
        .select("*")
        .eq("organization_id", organizationId)
        .single(),

      // Closed won trend (last N days)
      supabase
        .from("vw_closed_won_trend")
        .select("*")
        .eq("organization_id", organizationId)
        .gte("close_day", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
        .order("close_day", { ascending: true }),
    ]);

    // Calculate summary metrics from org benchmarks
    const benchmarks = benchmarksResult.data;
    const summary: GrowthPulseMetrics = {
      totalPipelineArr: benchmarks?.total_open_pipeline || 0,
      totalPipelineAmount: benchmarks?.total_open_pipeline || 0,
      openDeals: Math.round(benchmarks?.avg_open_deals || 0) * (benchmarks?.seller_count || 0),
      closedWonQtdArr: benchmarks?.total_closed_won_qtd || 0,
      closedWonQtdCount: 0, // Will calculate below
      avgDealSize: benchmarks?.avg_deal_size || 0,
      avgDealAgeDays: benchmarks?.avg_deal_age || null,
      sellerCount: benchmarks?.seller_count || 0,
    };

    // Get actual closed won count for QTD
    const { count: closedWonCount } = await supabase
      .from("hubspot_deals")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("deal_stage", "closedwon")
      .gte("close_date", getQuarterStart().toISOString());

    summary.closedWonQtdCount = closedWonCount || 0;

    // Get actual open deals count
    const { count: openCount } = await supabase
      .from("hubspot_deals")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("deal_stage", "in", "(closedwon,closedlost)");

    summary.openDeals = openCount || 0;

    // Format stage breakdown
    const pipelineByStage: StageBreakdown[] = (stagesResult.data || []).map((row) => ({
      stage: row.deal_stage || "Unknown",
      dealCount: row.deal_count || 0,
      totalArr: row.total_arr || 0,
      totalAmount: row.total_amount || 0,
      avgDealSize: row.avg_deal_size || 0,
      avgDaysInPipeline: row.avg_days_in_pipeline || null,
    }));

    // Format closed won trend
    const closedWonTrend: ClosedWonTrendItem[] = (trendResult.data || []).map((row) => ({
      date: row.close_day,
      dealCount: row.deal_count || 0,
      totalArr: row.total_arr || 0,
      totalAmount: row.total_amount || 0,
    }));

    // Format org benchmarks
    const orgBenchmarks: OrgBenchmarks = {
      avgOpenPipeline: benchmarks?.avg_open_pipeline || 0,
      avgClosedWonQtd: benchmarks?.avg_closed_won_qtd || 0,
      avgOpenDeals: benchmarks?.avg_open_deals || 0,
      avgDealAge: benchmarks?.avg_deal_age || null,
      avgDealSize: benchmarks?.avg_deal_size || 0,
      leaderClosedWonQtd: benchmarks?.leader_closed_won_qtd || 0,
      leaderOpenPipeline: benchmarks?.leader_open_pipeline || 0,
      leaderOpenDeals: benchmarks?.leader_open_deals || 0,
      totalOpenPipeline: benchmarks?.total_open_pipeline || 0,
      totalClosedWonQtd: benchmarks?.total_closed_won_qtd || 0,
      sellerCount: benchmarks?.seller_count || 0,
    };

    const response: GrowthPulseMetricsResponse = {
      summary,
      pipelineByStage,
      closedWonTrend,
      benchmarks: orgBenchmarks,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching growth pulse metrics:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}

// Helper to get the start of the current quarter
function getQuarterStart(): Date {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  return new Date(now.getFullYear(), quarter * 3, 1);
}
