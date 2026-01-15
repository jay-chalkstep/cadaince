import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { DealsListResponse, DealSummary } from "@/types/growth-pulse";

// GET /api/growth-pulse/deals
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
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = (page - 1) * limit;

  // Filters
  const ownerId = searchParams.get("owner_id");
  const stage = searchParams.get("stage");
  const pipeline = searchParams.get("pipeline");
  const offering = searchParams.get("offering");
  const includeClused = searchParams.get("include_closed") === "true";

  // Sorting
  const sortBy = searchParams.get("sort_by") || "hs_arr";
  const sortOrder = searchParams.get("sort_order") || "desc";

  try {
    // Build query
    let query = supabase
      .from("hubspot_deals")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId);

    // Apply filters
    if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }
    if (stage) {
      query = query.eq("deal_stage", stage);
    }
    if (pipeline) {
      query = query.eq("pipeline", pipeline);
    }
    if (offering) {
      query = query.eq("offering", offering);
    }
    if (!includeClused) {
      query = query.not("deal_stage", "in", "(closedwon,closedlost)");
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === "asc", nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data: deals, count, error } = await query;

    if (error) {
      console.error("Error fetching deals:", error);
      return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
    }

    // Fetch owner names for deals
    const ownerIds = [...new Set((deals || []).map((d) => d.owner_id).filter(Boolean))];
    const ownerMap = new Map<string, string>();

    if (ownerIds.length > 0) {
      const { data: owners } = await supabase
        .from("hubspot_owners")
        .select("hubspot_owner_id, first_name, last_name")
        .eq("organization_id", organizationId)
        .in("hubspot_owner_id", ownerIds);

      for (const owner of owners || []) {
        const name = `${owner.first_name || ""} ${owner.last_name || ""}`.trim();
        if (name) {
          ownerMap.set(owner.hubspot_owner_id, name);
        }
      }
    }

    // Format deals
    const formattedDeals: DealSummary[] = (deals || []).map((deal) => ({
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
      ownerName: deal.owner_id ? ownerMap.get(deal.owner_id) || null : null,
    }));

    const response: DealsListResponse = {
      deals: formattedDeals,
      total: count || 0,
      page,
      limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching deals:", error);
    return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
  }
}
