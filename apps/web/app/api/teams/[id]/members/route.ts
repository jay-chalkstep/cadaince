import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/teams/:id/members - Get team members from computed view
 *
 * Returns all members of the team, including:
 * - Direct team lead (anchor seat holder)
 * - All descendants in the seat hierarchy
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

  // Verify team exists in this org
  const { data: team } = await supabase
    .from("teams")
    .select("id, name, organization_id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Get members from the computed view
  const { data: memberships, error: membershipError } = await supabase
    .from("team_memberships")
    .select("profile_id, is_lead")
    .eq("team_id", id);

  if (membershipError) {
    console.error("Error fetching memberships:", membershipError);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ members: [], team });
  }

  // Get full profile data for each member
  const profileIds = memberships.map((m) => m.profile_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      avatar_url,
      email,
      title,
      access_level
    `)
    .in("id", profileIds);

  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
    return NextResponse.json({ error: "Failed to fetch member profiles" }, { status: 500 });
  }

  // Combine membership data with profile data
  const members = (profiles || []).map((p) => {
    const membership = memberships.find((m) => m.profile_id === p.id);
    return {
      ...p,
      is_lead: membership?.is_lead || false,
    };
  });

  // Sort: leads first, then alphabetically
  members.sort((a, b) => {
    if (a.is_lead && !b.is_lead) return -1;
    if (!a.is_lead && b.is_lead) return 1;
    return (a.full_name || "").localeCompare(b.full_name || "");
  });

  return NextResponse.json({
    team: { id: team.id, name: team.name },
    members,
    total: members.length,
    leads: members.filter((m) => m.is_lead).length,
  });
}
