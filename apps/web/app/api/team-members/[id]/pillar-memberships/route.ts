import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/team-members/[id]/pillar-memberships - List pillar memberships for a member
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: memberId } = await params;
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

  // Verify the member belongs to the same org
  const { data: member } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", memberId)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  }

  // Get pillar memberships
  const { data: memberships, error } = await supabase
    .from("team_member_pillars")
    .select(`
      *,
      pillar:pillars(id, name, slug, color)
    `)
    .eq("team_member_id", memberId)
    .order("is_primary", { ascending: false });

  if (error) {
    console.error("Error fetching pillar memberships:", error);
    return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 });
  }

  return NextResponse.json(memberships);
}

// POST /api/team-members/[id]/pillar-memberships - Add member to a pillar
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: memberId } = await params;
  const supabase = createAdminClient();

  // Get user's profile and check admin access
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  // Verify the member belongs to the same org
  const { data: member } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", memberId)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  }

  const body = await req.json();
  const { pillar_id, is_primary, is_lead } = body;

  if (!pillar_id) {
    return NextResponse.json({ error: "pillar_id is required" }, { status: 400 });
  }

  // Verify pillar belongs to org
  const { data: pillar } = await supabase
    .from("pillars")
    .select("id")
    .eq("id", pillar_id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!pillar) {
    return NextResponse.json({ error: "Pillar not found" }, { status: 404 });
  }

  // Check if membership already exists
  const { data: existing } = await supabase
    .from("team_member_pillars")
    .select("id")
    .eq("team_member_id", memberId)
    .eq("pillar_id", pillar_id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Member is already assigned to this pillar" },
      { status: 400 }
    );
  }

  // If setting as primary, unset other primary memberships
  if (is_primary) {
    await supabase
      .from("team_member_pillars")
      .update({ is_primary: false })
      .eq("team_member_id", memberId);
  }

  // If setting as lead, check if pillar already has a lead
  if (is_lead) {
    const { data: existingLead } = await supabase
      .from("team_member_pillars")
      .select("id, team_member_id")
      .eq("pillar_id", pillar_id)
      .eq("is_lead", true)
      .single();

    if (existingLead) {
      // Optionally: remove lead status from existing lead
      await supabase
        .from("team_member_pillars")
        .update({ is_lead: false })
        .eq("id", existingLead.id);
    }
  }

  const { data: membership, error } = await supabase
    .from("team_member_pillars")
    .insert({
      organization_id: profile.organization_id,
      team_member_id: memberId,
      pillar_id,
      is_primary: is_primary || false,
      is_lead: is_lead || false,
    })
    .select(`
      *,
      pillar:pillars(id, name, slug, color)
    `)
    .single();

  if (error) {
    console.error("Error creating pillar membership:", error);
    return NextResponse.json({ error: "Failed to add to pillar" }, { status: 500 });
  }

  return NextResponse.json(membership, { status: 201 });
}

// DELETE /api/team-members/[id]/pillar-memberships - Remove member from a pillar
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: memberId } = await params;
  const supabase = createAdminClient();

  // Get user's profile and check admin access
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const pillarId = searchParams.get("pillar_id");

  if (!pillarId) {
    return NextResponse.json({ error: "pillar_id query param is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("team_member_pillars")
    .delete()
    .eq("team_member_id", memberId)
    .eq("pillar_id", pillarId)
    .eq("organization_id", profile.organization_id);

  if (error) {
    console.error("Error removing pillar membership:", error);
    return NextResponse.json({ error: "Failed to remove from pillar" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH /api/team-members/[id]/pillar-memberships - Update membership (is_primary, is_lead)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: memberId } = await params;
  const supabase = createAdminClient();

  // Get user's profile and check admin access
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { pillar_id, is_primary, is_lead } = body;

  if (!pillar_id) {
    return NextResponse.json({ error: "pillar_id is required" }, { status: 400 });
  }

  // If setting as primary, unset other primary memberships
  if (is_primary) {
    await supabase
      .from("team_member_pillars")
      .update({ is_primary: false })
      .eq("team_member_id", memberId)
      .neq("pillar_id", pillar_id);
  }

  // If setting as lead, unset other leads for this pillar
  if (is_lead) {
    await supabase
      .from("team_member_pillars")
      .update({ is_lead: false })
      .eq("pillar_id", pillar_id)
      .neq("team_member_id", memberId);
  }

  const updateData: Record<string, boolean> = {};
  if (is_primary !== undefined) updateData.is_primary = is_primary;
  if (is_lead !== undefined) updateData.is_lead = is_lead;

  const { data: membership, error } = await supabase
    .from("team_member_pillars")
    .update(updateData)
    .eq("team_member_id", memberId)
    .eq("pillar_id", pillar_id)
    .eq("organization_id", profile.organization_id)
    .select(`
      *,
      pillar:pillars(id, name, slug, color)
    `)
    .single();

  if (error) {
    console.error("Error updating pillar membership:", error);
    return NextResponse.json({ error: "Failed to update membership" }, { status: 500 });
  }

  return NextResponse.json(membership);
}
