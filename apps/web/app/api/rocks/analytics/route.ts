import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/rocks/analytics - Get company rock analytics with cascade metrics
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

  const { searchParams } = new URL(req.url);
  const quarterId = searchParams.get("quarter_id");

  // Get company rocks with cascade analytics
  // Since views might not be available, we'll compute this manually
  let companyRocksQuery = supabase
    .from("rocks")
    .select(`
      *,
      owner:profiles!rocks_owner_id_fkey(id, full_name, avatar_url, title),
      quarter:quarters!rocks_quarter_id_fkey(id, year, quarter, planning_status)
    `)
    .eq("organization_id", profile.organization_id)
    .eq("rock_level", "company")
    .order("title", { ascending: true });

  if (quarterId) {
    companyRocksQuery = companyRocksQuery.eq("quarter_id", quarterId);
  }

  const { data: companyRocks, error: rocksError } = await companyRocksQuery;

  if (rocksError) {
    console.error("Error fetching company rocks:", rocksError);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }

  if (!companyRocks || companyRocks.length === 0) {
    return NextResponse.json({
      company_rocks: [],
      summary: {
        total_company_rocks: 0,
        total_pillar_rocks: 0,
        total_individual_rocks: 0,
        overall_on_track_percentage: 0,
      },
    });
  }

  // Get all pillar and individual rocks for these company rocks
  const companyRockIds = companyRocks.map((r) => r.id);

  const { data: pillarRocks } = await supabase
    .from("rocks")
    .select(`
      *,
      owner:profiles!rocks_owner_id_fkey(id, full_name, avatar_url),
      pillar:pillars!rocks_pillar_id_fkey(id, name, color)
    `)
    .in("parent_rock_id", companyRockIds)
    .eq("rock_level", "pillar");

  const pillarRockIds = pillarRocks?.map((r) => r.id) || [];

  const { data: individualRocks } = await supabase
    .from("rocks")
    .select(`
      *,
      owner:profiles!rocks_owner_id_fkey(id, full_name, avatar_url),
      pillar:pillars!rocks_pillar_id_fkey(id, name, color)
    `)
    .in("parent_rock_id", pillarRockIds)
    .eq("rock_level", "individual");

  // Get team count for coverage calculations
  const { count: teamCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", profile.organization_id)
    .eq("status", "active")
    .in("access_level", ["admin", "elt", "slt"]);

  // Build analytics for each company rock
  const companyRockAnalytics = companyRocks.map((cr) => {
    const crPillarRocks = pillarRocks?.filter((pr) => pr.parent_rock_id === cr.id) || [];
    const crPillarRockIds = crPillarRocks.map((pr) => pr.id);
    const crIndividualRocks = individualRocks?.filter((ir) =>
      crPillarRockIds.includes(ir.parent_rock_id)
    ) || [];

    const allDescendants = [...crPillarRocks, ...crIndividualRocks];
    const uniqueOwners = new Set(crIndividualRocks.map((r) => r.owner_id));
    const uniquePillars = new Set(crPillarRocks.map((r) => r.pillar_id).filter(Boolean));

    return {
      ...cr,
      analytics: {
        pillar_rock_count: crPillarRocks.length,
        pillar_rocks_on_track: crPillarRocks.filter((r) => r.status === "on_track").length,
        pillar_rocks_off_track: crPillarRocks.filter((r) => r.status === "off_track").length,
        pillar_rocks_at_risk: crPillarRocks.filter((r) => r.status === "at_risk").length,
        pillar_rocks_complete: crPillarRocks.filter((r) => r.status === "complete").length,

        individual_rock_count: crIndividualRocks.length,
        individual_rocks_on_track: crIndividualRocks.filter((r) => r.status === "on_track").length,
        individual_rocks_off_track: crIndividualRocks.filter((r) => r.status === "off_track").length,
        individual_rocks_at_risk: crIndividualRocks.filter((r) => r.status === "at_risk").length,
        individual_rocks_complete: crIndividualRocks.filter((r) => r.status === "complete").length,

        team_members_with_rocks: uniqueOwners.size,
        team_coverage_percentage: teamCount ? Math.round((uniqueOwners.size / teamCount) * 100) : 0,
        pillars_involved: uniquePillars.size,

        overall_on_track_percentage: allDescendants.length > 0
          ? Math.round(
              (allDescendants.filter((r) => r.status === "on_track" || r.status === "complete").length /
                allDescendants.length) *
                100
            )
          : 0,
      },
      pillar_rocks: crPillarRocks.map((pr) => ({
        ...pr,
        individual_rocks: crIndividualRocks.filter((ir) => ir.parent_rock_id === pr.id),
      })),
    };
  });

  // Calculate summary stats
  const allPillarRocks = pillarRocks || [];
  const allIndividualRocks = individualRocks || [];
  const allRocks = [...companyRocks, ...allPillarRocks, ...allIndividualRocks];

  const summary = {
    total_company_rocks: companyRocks.length,
    total_pillar_rocks: allPillarRocks.length,
    total_individual_rocks: allIndividualRocks.length,
    total_rocks: allRocks.length,

    on_track: allRocks.filter((r) => r.status === "on_track").length,
    off_track: allRocks.filter((r) => r.status === "off_track").length,
    at_risk: allRocks.filter((r) => r.status === "at_risk").length,
    complete: allRocks.filter((r) => r.status === "complete").length,

    overall_on_track_percentage: allRocks.length > 0
      ? Math.round(
          (allRocks.filter((r) => r.status === "on_track" || r.status === "complete").length /
            allRocks.length) *
            100
        )
      : 0,

    team_size: teamCount || 0,
    team_members_with_rocks: new Set(allIndividualRocks.map((r) => r.owner_id)).size,
  };

  return NextResponse.json({
    company_rocks: companyRockAnalytics,
    summary,
  });
}
