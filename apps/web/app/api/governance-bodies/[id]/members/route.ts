import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/governance-bodies/:id/members - List members of a governance body
 */
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
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

  // Verify governance body exists and belongs to org
  const { data: body } = await supabase
    .from("governance_bodies")
    .select("id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!body) {
    return NextResponse.json({ error: "Governance body not found" }, { status: 404 });
  }

  // Fetch members with profile info
  const { data: members, error } = await supabase
    .from("governance_body_memberships")
    .select(`
      id,
      is_chair,
      role_title,
      added_at,
      profile:profiles(
        id,
        full_name,
        email,
        avatar_url,
        title,
        access_level
      )
    `)
    .eq("governance_body_id", id)
    .order("is_chair", { ascending: false })
    .order("added_at", { ascending: true });

  if (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }

  return NextResponse.json({ members: members || [] });
}

/**
 * POST /api/governance-bodies/:id/members - Add a member to a governance body
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile and check permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (!["admin", "elt"].includes(profile.access_level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify governance body exists and belongs to org
  const { data: body } = await supabase
    .from("governance_bodies")
    .select("id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!body) {
    return NextResponse.json({ error: "Governance body not found" }, { status: 404 });
  }

  const requestBody = await req.json();
  const { profile_id, is_chair, role_title } = requestBody;

  if (!profile_id) {
    return NextResponse.json({ error: "profile_id is required" }, { status: 400 });
  }

  // Verify the profile belongs to the same organization
  const { data: memberProfile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", profile_id)
    .single();

  if (!memberProfile || memberProfile.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Profile not found in organization" }, { status: 404 });
  }

  // Add the membership
  const { data: membership, error } = await supabase
    .from("governance_body_memberships")
    .insert({
      governance_body_id: id,
      profile_id,
      is_chair: is_chair || false,
      role_title,
      added_by: profile.id,
    })
    .select(`
      id,
      is_chair,
      role_title,
      added_at,
      profile:profiles(
        id,
        full_name,
        email,
        avatar_url,
        title,
        access_level
      )
    `)
    .single();

  if (error) {
    console.error("Error adding member:", error);
    if (error.code === "23505") {
      return NextResponse.json({ error: "Member already exists in this governance body" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }

  return NextResponse.json(membership, { status: 201 });
}

/**
 * DELETE /api/governance-bodies/:id/members - Remove a member from a governance body
 *
 * Query param: member_id - the profile ID to remove
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile and check permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (!["admin", "elt"].includes(profile.access_level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const memberId = url.searchParams.get("member_id");

  if (!memberId) {
    return NextResponse.json({ error: "member_id query param is required" }, { status: 400 });
  }

  // Verify governance body exists and belongs to org
  const { data: body } = await supabase
    .from("governance_bodies")
    .select("id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!body) {
    return NextResponse.json({ error: "Governance body not found" }, { status: 404 });
  }

  // Remove the membership
  const { error } = await supabase
    .from("governance_body_memberships")
    .delete()
    .eq("governance_body_id", id)
    .eq("profile_id", memberId);

  if (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
