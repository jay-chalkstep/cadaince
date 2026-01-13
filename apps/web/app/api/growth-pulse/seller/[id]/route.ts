import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type {
  SellerDetail,
  StageBreakdown,
  OfferingBreakdown,
  DealSummary,
  AccountActivity,
  ActivityItem,
  BenchmarkComparison,
} from "@/types/growth-pulse";

// GET /api/growth-pulse/seller/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: ownerId } = await params;

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

  try {
    // Fetch all data in parallel
    const [
      ownerResult,
      sellerSummaryResult,
      orgBenchmarksResult,
      allSellersSummaryResult,
      dealsResult,
      activitiesResult,
    ] = await Promise.all([
      // Owner info
      supabase
        .from("hubspot_owners")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("hubspot_owner_id", ownerId)
        .single(),

      // Seller summary from view
      supabase
        .from("vw_seller_pipeline_summary")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("owner_id", ownerId)
        .single(),

      // Org benchmarks
      supabase
        .from("vw_org_benchmarks")
        .select("*")
        .eq("organization_id", organizationId)
        .single(),

      // All sellers for percentile calculation
      supabase
        .from("vw_seller_pipeline_summary")
        .select("open_pipeline_arr, closed_won_qtd_arr, open_deal_count, avg_deal_age_days")
        .eq("organization_id", organizationId),

      // This seller's deals
      supabase
        .from("hubspot_deals")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("owner_id", ownerId)
        .order("hs_arr", { ascending: false, nullsFirst: false }),

      // This seller's recent activities
      supabase
        .from("hubspot_activities")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("owner_id", ownerId)
        .order("activity_date", { ascending: false })
        .limit(50),
    ]);

    if (!ownerResult.data) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    const owner = ownerResult.data;
    const sellerSummary = sellerSummaryResult.data;
    const orgBenchmarks = orgBenchmarksResult.data;
    const allSellers = allSellersSummaryResult.data || [];
    const deals = dealsResult.data || [];
    const activities = activitiesResult.data || [];

    // Calculate stage distribution
    const stageMap = new Map<string, { count: number; arr: number }>();
    let totalOpenArr = 0;

    for (const deal of deals) {
      if (deal.deal_stage === "closedwon" || deal.deal_stage === "closedlost") continue;

      const stage = deal.deal_stage || "Unknown";
      const current = stageMap.get(stage) || { count: 0, arr: 0 };
      current.count++;
      current.arr += deal.hs_arr || deal.amount || 0;
      stageMap.set(stage, current);
      totalOpenArr += deal.hs_arr || deal.amount || 0;
    }

    const stageDistribution: StageBreakdown[] = Array.from(stageMap.entries())
      .map(([stage, data]) => ({
        stage,
        dealCount: data.count,
        totalArr: data.arr,
        totalAmount: data.arr,
        avgDealSize: data.count > 0 ? data.arr / data.count : 0,
        avgDaysInPipeline: null, // Would need stage history to calculate
      }))
      .sort((a, b) => b.totalArr - a.totalArr);

    // Calculate offering distribution
    const offeringMap = new Map<string, { count: number; arr: number }>();

    for (const deal of deals) {
      if (deal.deal_stage === "closedwon" || deal.deal_stage === "closedlost") continue;

      const offering = deal.offering || deal.deal_type || "Other";
      const current = offeringMap.get(offering) || { count: 0, arr: 0 };
      current.count++;
      current.arr += deal.hs_arr || deal.amount || 0;
      offeringMap.set(offering, current);
    }

    const offeringDistribution: OfferingBreakdown[] = Array.from(offeringMap.entries())
      .map(([offering, data]) => ({
        offering,
        dealCount: data.count,
        totalArr: data.arr,
        percentage: totalOpenArr > 0 ? Math.round((data.arr / totalOpenArr) * 100) : 0,
      }))
      .sort((a, b) => b.totalArr - a.totalArr);

    // Get top deals (open, sorted by ARR)
    const topDeals: DealSummary[] = deals
      .filter((d) => d.deal_stage !== "closedwon" && d.deal_stage !== "closedlost")
      .slice(0, 10)
      .map((deal) => ({
        id: deal.id,
        hubspotDealId: deal.hubspot_deal_id,
        dealName: deal.deal_name,
        amount: deal.amount,
        arr: deal.hs_arr,
        stage: deal.deal_stage,
        pipeline: deal.pipeline,
        dealType: deal.deal_type,
        offering: deal.offering,
        closeDate: deal.close_date,
        createDate: deal.create_date,
        companyName: deal.company_name,
        daysInPipeline: deal.create_date
          ? Math.floor((Date.now() - new Date(deal.create_date).getTime()) / (1000 * 60 * 60 * 24))
          : null,
        ownerId: deal.owner_id,
        ownerName: `${owner.first_name || ""} ${owner.last_name || ""}`.trim() || null,
      }));

    // Calculate top accounts by activity
    const accountActivityMap = new Map<string, { companyName: string; dealCount: number; totalArr: number; activityCount: number; lastActivityDate: string | null }>();

    for (const deal of deals) {
      if (!deal.company_id) continue;

      const current = accountActivityMap.get(deal.company_id) || {
        companyName: deal.company_name || "Unknown",
        dealCount: 0,
        totalArr: 0,
        activityCount: 0,
        lastActivityDate: null,
      };
      current.dealCount++;
      current.totalArr += deal.hs_arr || deal.amount || 0;
      accountActivityMap.set(deal.company_id, current);
    }

    // Add activity counts
    for (const activity of activities) {
      if (!activity.company_id) continue;

      const current = accountActivityMap.get(activity.company_id);
      if (current) {
        current.activityCount++;
        if (!current.lastActivityDate || (activity.activity_date && activity.activity_date > current.lastActivityDate)) {
          current.lastActivityDate = activity.activity_date;
        }
      }
    }

    const topAccounts: AccountActivity[] = Array.from(accountActivityMap.entries())
      .map(([companyId, data]) => ({
        companyId,
        ...data,
      }))
      .sort((a, b) => b.activityCount - a.activityCount)
      .slice(0, 10);

    // Format recent activities
    const recentActivities: ActivityItem[] = activities.slice(0, 20).map((activity) => ({
      id: activity.id,
      activityType: activity.activity_type,
      subject: activity.subject,
      activityDate: activity.activity_date,
      dealId: activity.deal_id,
      companyId: activity.company_id,
    }));

    // Calculate benchmark comparisons
    const sellerOpenPipeline = sellerSummary?.open_pipeline_arr || 0;
    const sellerClosedWonQtd = sellerSummary?.closed_won_qtd_arr || 0;
    const sellerOpenDeals = sellerSummary?.open_deal_count || 0;
    const sellerDealAge = sellerSummary?.avg_deal_age_days || 0;

    const benchmarks: BenchmarkComparison[] = [
      {
        metric: "Open Pipeline",
        sellerValue: sellerOpenPipeline,
        teamAvg: orgBenchmarks?.avg_open_pipeline || 0,
        leader: orgBenchmarks?.leader_open_pipeline || 0,
        percentile: calculatePercentile(
          sellerOpenPipeline,
          allSellers.map((s) => s.open_pipeline_arr)
        ),
      },
      {
        metric: "Closed Won QTD",
        sellerValue: sellerClosedWonQtd,
        teamAvg: orgBenchmarks?.avg_closed_won_qtd || 0,
        leader: orgBenchmarks?.leader_closed_won_qtd || 0,
        percentile: calculatePercentile(
          sellerClosedWonQtd,
          allSellers.map((s) => s.closed_won_qtd_arr)
        ),
      },
      {
        metric: "Open Deals",
        sellerValue: sellerOpenDeals,
        teamAvg: orgBenchmarks?.avg_open_deals || 0,
        leader: orgBenchmarks?.leader_open_deals || 0,
        percentile: calculatePercentile(
          sellerOpenDeals,
          allSellers.map((s) => s.open_deal_count)
        ),
      },
    ];

    // Build response
    const response: SellerDetail = {
      owner: {
        id: owner.id,
        hubspotOwnerId: owner.hubspot_owner_id,
        name: `${owner.first_name || ""} ${owner.last_name || ""}`.trim() || "Unknown",
        email: owner.email,
        firstName: owner.first_name,
        lastName: owner.last_name,
      },
      metrics: {
        openPipelineArr: sellerOpenPipeline,
        openDealCount: sellerOpenDeals,
        closedWonQtdArr: sellerClosedWonQtd,
        closedWonQtdCount: sellerSummary?.closed_won_qtd_count || 0,
        avgDealSize: sellerSummary?.avg_open_deal_size || 0,
        avgDealAgeDays: sellerDealAge || null,
      },
      benchmarks,
      stageDistribution,
      offeringDistribution,
      topDeals,
      topAccounts,
      recentActivities,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching seller detail:", error);
    return NextResponse.json({ error: "Failed to fetch seller detail" }, { status: 500 });
  }
}

// Calculate percentile of a value in a list
function calculatePercentile(value: number, values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v < value).length;

  return Math.round((rank / sorted.length) * 100);
}
