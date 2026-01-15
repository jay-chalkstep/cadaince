import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type {
  GrowthPulseMetricsResponse,
  GpvStageBreakdown,
  OrgBenchmarks,
  GrowthPulseMetrics,
} from "@/types/growth-pulse";
import {
  SALES_PIPELINE_ID,
  SALES_PIPELINE_STAGES,
  SALES_PIPELINE_STAGE_ORDER,
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

  // Get velocity_days from query params (default 7)
  const { searchParams } = new URL(req.url);
  const velocityDays = parseInt(searchParams.get("velocity_days") || "7");

  try {
    // Calculate the date threshold for velocity
    const velocityThreshold = new Date();
    velocityThreshold.setDate(velocityThreshold.getDate() - velocityDays);

    // Fetch summary benchmarks, GPV by stage, and stage changes in parallel
    const [benchmarksResult, gpvDealsResult, stageChangesResult, openCountResult] = await Promise.all([
      // Org benchmarks for summary metrics
      supabase
        .from("vw_org_benchmarks")
        .select("*")
        .eq("organization_id", organizationId)
        .single(),

      // GPV by stage - fetch deals from Sales Pipeline for the 5 target stages
      supabase
        .from("hubspot_deals")
        .select("deal_stage, properties")
        .eq("organization_id", organizationId)
        .eq("pipeline", SALES_PIPELINE_ID)
        .in("deal_stage", SALES_PIPELINE_STAGE_ORDER),

      // Stage changes count within velocity window (only tracked stages)
      supabase
        .from("hubspot_deal_stage_history")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("entered_at", velocityThreshold.toISOString())
        .or(`from_stage.in.(${SALES_PIPELINE_STAGE_ORDER.join(",")}),to_stage.in.(${SALES_PIPELINE_STAGE_ORDER.join(",")})`),

      // Get open deals count for Sales Pipeline (5 tracked stages only)
      supabase
        .from("hubspot_deals")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("pipeline", SALES_PIPELINE_ID)
        .in("deal_stage", SALES_PIPELINE_STAGE_ORDER),
    ]);

    // Calculate summary metrics from org benchmarks
    const benchmarks = benchmarksResult.data;
    const summary: GrowthPulseMetrics = {
      totalPipelineArr: benchmarks?.total_open_pipeline || 0,
      totalPipelineAmount: benchmarks?.total_open_pipeline || 0,
      openDeals: openCountResult.count || 0,
      stageChanges: stageChangesResult.count || 0,
      avgDealSize: benchmarks?.avg_deal_size || 0,
      avgDealAgeDays: benchmarks?.avg_deal_age || null,
      sellerCount: benchmarks?.seller_count || 0,
    };

    // Aggregate GPV by stage
    const gpvByStageMap: Record<string, { dealCount: number; gpvFullYear: number; gpvInCurrentYear: number; gpByStage: number }> = {};

    // Initialize all stages with zero values
    for (const stageId of SALES_PIPELINE_STAGE_ORDER) {
      gpvByStageMap[stageId] = { dealCount: 0, gpvFullYear: 0, gpvInCurrentYear: 0, gpByStage: 0 };
    }

    // Sum up GPV values from deals
    for (const deal of gpvDealsResult.data || []) {
      const stageId = deal.deal_stage;
      if (stageId && gpvByStageMap[stageId]) {
        const props = deal.properties as Record<string, string | null> | null;
        gpvByStageMap[stageId].dealCount += 1;
        gpvByStageMap[stageId].gpvFullYear += parseFloat(props?.gross_payment_volume || "0") || 0;
        gpvByStageMap[stageId].gpvInCurrentYear += parseFloat(props?.annual_gross_payment_volume || "0") || 0;
        gpvByStageMap[stageId].gpByStage += parseFloat(props?.gp_in_current_year || "0") || 0;
      }
    }

    // Calculate total pipeline GPV from the aggregated Sales Pipeline data
    const totalPipelineGpv = Object.values(gpvByStageMap).reduce(
      (sum, stage) => sum + stage.gpvFullYear, 0
    );
    summary.totalPipelineAmount = totalPipelineGpv;
    summary.totalPipelineArr = totalPipelineGpv;

    // Convert to ordered array with stage metadata
    const gpvByStage: GpvStageBreakdown[] = SALES_PIPELINE_STAGE_ORDER.map((stageId) => {
      const stageInfo = SALES_PIPELINE_STAGES[stageId];
      const aggregated = gpvByStageMap[stageId];
      return {
        stageId,
        stageLabel: stageInfo.label,
        shortLabel: stageInfo.shortLabel,
        order: stageInfo.order,
        dealCount: aggregated.dealCount,
        gpvFullYear: aggregated.gpvFullYear,
        gpvInCurrentYear: aggregated.gpvInCurrentYear,
        gpByStage: aggregated.gpByStage,
      };
    });

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
      gpvByStage,
      benchmarks: orgBenchmarks,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching growth pulse metrics:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
