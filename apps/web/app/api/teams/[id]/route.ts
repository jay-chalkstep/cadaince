import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/teams/:id - Get team details with members and related data
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Get team with related data
  const { data: team, error } = await supabase
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
      updated_at,
      anchor_seat:seats!teams_anchor_seat_id_fkey(
        id,
        name,
        eos_role,
        pillar:pillars!seats_pillar_id_fkey(id, name, color),
        assignments:seat_assignments(
          id,
          is_primary,
          team_member:profiles!seat_assignments_team_member_id_fkey(
            id, full_name, avatar_url, email, title
          )
        )
      ),
      parent_team:teams!teams_parent_team_id_fkey(
        id,
        name,
        slug,
        level
      ),
      child_teams:teams!teams_parent_team_id_fkey1(
        id,
        name,
        slug,
        level,
        is_elt
      )
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !team) {
    console.error("Error fetching team:", error);
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Get team members from the computed view
  const { data: members } = await supabase
    .from("team_memberships")
    .select("profile_id, is_lead")
    .eq("team_id", id);

  // Get member profiles
  let memberProfiles: Array<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string;
    title: string | null;
    is_lead: boolean;
  }> = [];

  if (members && members.length > 0) {
    const profileIds = members.map((m) => m.profile_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email, title")
      .in("id", profileIds);

    if (profiles) {
      memberProfiles = profiles.map((p) => ({
        ...p,
        is_lead: members.find((m) => m.profile_id === p.id)?.is_lead || false,
      }));
    }
  }

  // Get counts for related items
  const [rocksResult, issuesResult, goalsResult] = await Promise.all([
    supabase
      .from("rocks")
      .select("id", { count: "exact", head: true })
      .eq("team_id", id),
    supabase
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("team_id", id)
      .in("status", ["open", "queued"]),
    supabase
      .from("individual_goals")
      .select("id", { count: "exact", head: true })
      .eq("team_id", id),
  ]);

  return NextResponse.json({
    ...team,
    members: memberProfiles,
    counts: {
      rocks: rocksResult.count || 0,
      open_issues: issuesResult.count || 0,
      goals: goalsResult.count || 0,
      members: memberProfiles.length,
    },
  });
}

/**
 * PATCH /api/teams/:id - Update team settings
 * Note: Name, slug, level, etc. are auto-synced from AC
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin and ELT can update teams
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify team exists in this org
  const { data: existingTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!existingTeam) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const body = await req.json();
  const { settings, l10_required } = body;

  const updateData: Record<string, unknown> = {};
  if (settings !== undefined) updateData.settings = settings;
  if (l10_required !== undefined) updateData.l10_required = l10_required;

  const { data: team, error } = await supabase
    .from("teams")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating team:", error);
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }

  return NextResponse.json(team);
}
