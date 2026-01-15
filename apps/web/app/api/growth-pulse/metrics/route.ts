import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type {
  GrowthPulseMetricsResponse,
  GpvStageBreakdown,
  OrgBenchmarks,
  GrowthPulseMetrics,
  ActivityBySeller,
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
    // Fetch org settings to get excluded owners
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single();

    const orgSettings = org?.settings as Record<string, unknown> | null;
    const pulseSettings = orgSettings?.pulse_settings as { growth_pulse_excluded_owners?: string[] } | undefined;
    const excludedOwners = pulseSettings?.growth_pulse_excluded_owners || [];

    // Calculate the date threshold for velocity
    const velocityThreshold = new Date();
    velocityThreshold.setDate(velocityThreshold.getDate() - velocityDays);

    // Build base deal query with owner exclusion
    let gpvDealsQuery = supabase
      .from("hubspot_deals")
      .select("deal_stage, properties, owner_id")
      .eq("organization_id", organizationId)
      .eq("pipeline", SALES_PIPELINE_ID)
      .in("deal_stage", SALES_PIPELINE_STAGE_ORDER);

    let openCountQuery = supabase
      .from("hubspot_deals")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("pipeline", SALES_PIPELINE_ID)
      .in("deal_stage", SALES_PIPELINE_STAGE_ORDER);

    // Apply owner exclusion filter if there are excluded owners
    if (excludedOwners.length > 0) {
      const excludeFilter = `(${excludedOwners.join(",")})`;
      gpvDealsQuery = gpvDealsQuery.not("owner_id", "in", excludeFilter);
      openCountQuery = openCountQuery.not("owner_id", "in", excludeFilter);
    }

    // Fetch summary benchmarks, GPV by stage, and stage changes in parallel
    const [benchmarksResult, gpvDealsResult, stageChangesResult, openCountResult] = await Promise.all([
      // Org benchmarks for summary metrics
      supabase
        .from("vw_org_benchmarks")
        .select("*")
        .eq("organization_id", organizationId)
        .single(),

      // GPV by stage - fetch deals from Sales Pipeline for the 5 target stages
      gpvDealsQuery,

      // Stage changes count within velocity window (only tracked stages)
      supabase
        .from("hubspot_deal_stage_history")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("entered_at", velocityThreshold.toISOString())
        .or(`from_stage.in.(${SALES_PIPELINE_STAGE_ORDER.join(",")}),to_stage.in.(${SALES_PIPELINE_STAGE_ORDER.join(",")})`),

      // Get open deals count for Sales Pipeline (5 tracked stages only)
      openCountQuery,
    ]);

    // Aggregate GPV by stage and count unique sellers
    const gpvByStageMap: Record<string, { dealCount: number; gpvFullYear: number; gpvInCurrentYear: number; gpByStage: number; gpFullYear: number; numNotes: number }> = {};
    const uniqueOwners = new Set<string>();
    const activityBySellerMap = new Map<string, { numNotes: number; dealCount: number }>();

    // 30-day metrics
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let closingNext30DaysGpv = 0;
    let closingNext30DaysGp = 0;
    let closingNext30DaysCount = 0;
    let launchingNext30DaysGpv = 0;
    let launchingNext30DaysGp = 0;
    let launchingNext30DaysCount = 0;
    let totalNumNotes = 0;
    let totalPipelineGp = 0;

    // Initialize all stages with zero values
    for (const stageId of SALES_PIPELINE_STAGE_ORDER) {
      gpvByStageMap[stageId] = { dealCount: 0, gpvFullYear: 0, gpvInCurrentYear: 0, gpByStage: 0, gpFullYear: 0, numNotes: 0 };
    }

    // Sum up GPV values from deals and collect unique owners
    for (const deal of gpvDealsResult.data || []) {
      const stageId = deal.deal_stage;
      const props = deal.properties as Record<string, string | null> | null;

      // Parse values with fallbacks for both property name variants
      const gpvFullYearVal = parseFloat(props?.gross_payment_volume || props?.gpv__full_year_ || "0") || 0;
      const gpvCurrentYearVal = parseFloat(props?.annual_gross_payment_volume || props?.gpv__current_year || "0") || 0;
      const gpCurrentYearVal = parseFloat(props?.gp_in_current_year || "0") || 0;
      const gpFullYearVal = parseFloat(props?.gp_full_year || props?.gp__full_year_ || "0") || 0;
      const numNotesVal = parseInt(props?.num_notes || "0", 10) || 0;

      if (stageId && gpvByStageMap[stageId]) {
        gpvByStageMap[stageId].dealCount += 1;
        gpvByStageMap[stageId].gpvFullYear += gpvFullYearVal;
        gpvByStageMap[stageId].gpvInCurrentYear += gpvCurrentYearVal;
        gpvByStageMap[stageId].gpByStage += gpCurrentYearVal;
        gpvByStageMap[stageId].gpFullYear += gpFullYearVal;
        gpvByStageMap[stageId].numNotes += numNotesVal;

        if (deal.owner_id) {
          uniqueOwners.add(deal.owner_id);

          // Track activity by seller
          const sellerActivity = activityBySellerMap.get(deal.owner_id) || { numNotes: 0, dealCount: 0 };
          sellerActivity.numNotes += numNotesVal;
          sellerActivity.dealCount += 1;
          activityBySellerMap.set(deal.owner_id, sellerActivity);
        }

        // Total metrics
        totalNumNotes += numNotesVal;
        totalPipelineGp += gpFullYearVal;

        // 30-day closing metrics
        const closeDate = props?.closedate ? new Date(props.closedate) : null;
        if (closeDate && closeDate >= now && closeDate <= thirtyDaysFromNow) {
          closingNext30DaysGpv += gpvFullYearVal;
          closingNext30DaysGp += gpFullYearVal;
          closingNext30DaysCount++;
        }

        // 30-day launching metrics
        const launchDate = props?.onboarding__desired_launch_date ? new Date(props.onboarding__desired_launch_date) : null;
        if (launchDate && launchDate >= now && launchDate <= thirtyDaysFromNow) {
          launchingNext30DaysGpv += gpvFullYearVal;
          launchingNext30DaysGp += gpFullYearVal;
          launchingNext30DaysCount++;
        }
      }
    }

    // Calculate total pipeline GPV from the aggregated Sales Pipeline data
    const totalPipelineGpv = Object.values(gpvByStageMap).reduce(
      (sum, stage) => sum + stage.gpvFullYear, 0
    );

    // Calculate summary metrics
    const benchmarks = benchmarksResult.data;
    const summary: GrowthPulseMetrics = {
      totalPipelineArr: totalPipelineGpv,
      totalPipelineAmount: totalPipelineGpv,
      totalPipelineGp,
      openDeals: openCountResult.count || 0,
      stageChanges: stageChangesResult.count || 0,
      avgDealSize: benchmarks?.avg_deal_size || 0,
      avgDealAgeDays: benchmarks?.avg_deal_age || null,
      sellerCount: uniqueOwners.size,
      closingNext30DaysGpv,
      closingNext30DaysGp,
      closingNext30DaysCount,
      launchingNext30DaysGpv,
      launchingNext30DaysGp,
      launchingNext30DaysCount,
      totalNumNotes,
    };

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
        gpFullYear: aggregated.gpFullYear,
        numNotes: aggregated.numNotes,
      };
    });

    // Fetch owner names for activity by seller chart
    const ownerIds = Array.from(activityBySellerMap.keys());
    let activityBySeller: ActivityBySeller[] = [];

    if (ownerIds.length > 0) {
      const { data: owners } = await supabase
        .from("hubspot_owners")
        .select("hubspot_owner_id, first_name, last_name")
        .eq("organization_id", organizationId)
        .in("hubspot_owner_id", ownerIds);

      const ownerNameMap = new Map(
        (owners || []).map(o => [
          o.hubspot_owner_id,
          `${o.first_name || ""} ${o.last_name || ""}`.trim() || "Unknown"
        ])
      );

      activityBySeller = Array.from(activityBySellerMap.entries())
        .map(([ownerId, data]) => ({
          ownerId,
          ownerName: ownerNameMap.get(ownerId) || "Unknown",
          numNotes: data.numNotes,
          dealCount: data.dealCount,
        }))
        .sort((a, b) => b.numNotes - a.numNotes);
    }

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
      activityBySeller,
      benchmarks: orgBenchmarks,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching growth pulse metrics:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
