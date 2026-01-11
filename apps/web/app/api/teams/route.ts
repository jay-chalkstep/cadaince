import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/teams - List all teams for the organization with hierarchy
 *
 * Returns teams with their parent relationships, anchor seat info,
 * and member counts. Teams are derived from the Accountability Chart.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const includeHierarchy = url.searchParams.get("hierarchy") === "true";
  const levelFilter = url.searchParams.get("level");

  // Build query
  // Note: Self-referencing FK hints don't work in PostgREST, so we omit the hint
  // for parent_team and let it resolve automatically via parent_team_id
  let query = supabase
    .from("teams")
    .select(`
      id,
      name,
      slug,
      level,
      is_elt,
      l10_required,
      parent_team_id,
      anchor_seat_id,
      settings,
      created_at,
      anchor_seat:seats!teams_anchor_seat_id_fkey(
        id,
        name,
        eos_role,
        pillar:pillars(id, name, color)
      )
    `)
    .eq("organization_id", profile.organization_id)
    .order("level", { ascending: true })
    .order("name", { ascending: true });

  // Apply level filter if specified
  if (levelFilter) {
    query = query.eq("level", parseInt(levelFilter, 10));
  }

  const { data: teams, error } = await query;

  if (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }

  // If hierarchy view requested, organize into tree structure
  if (includeHierarchy) {
    const teamMap = new Map(teams.map((t) => [t.id, { ...t, children: [] as typeof teams }]));
    const rootTeams: typeof teams = [];

    for (const team of teams) {
      const teamWithChildren = teamMap.get(team.id)!;
      if (team.parent_team_id && teamMap.has(team.parent_team_id)) {
        teamMap.get(team.parent_team_id)!.children.push(teamWithChildren);
      } else {
        rootTeams.push(teamWithChildren);
      }
    }

    return NextResponse.json({ teams: rootTeams, flat: teams });
  }

  return NextResponse.json({ teams });
}

/**
 * PATCH /api/teams - Bulk update team settings
 * Note: Teams are auto-synced from AC, so only settings can be updated here
 */
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin can bulk update teams
  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { updates } = body as { updates: Array<{ id: string; settings?: object; l10_required?: boolean }> };

  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "Updates array required" }, { status: 400 });
  }

  const results = [];
  for (const update of updates) {
    const updateData: Record<string, unknown> = {};
    if (update.settings !== undefined) updateData.settings = update.settings;
    if (update.l10_required !== undefined) updateData.l10_required = update.l10_required;

    const { data, error } = await supabase
      .from("teams")
      .update(updateData)
      .eq("id", update.id)
      .eq("organization_id", profile.organization_id)
      .select()
      .single();

    results.push({ id: update.id, success: !error, data, error: error?.message });
  }

  return NextResponse.json({ results });
}
