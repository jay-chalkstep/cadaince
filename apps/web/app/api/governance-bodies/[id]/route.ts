import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/governance-bodies/:id - Get a governance body with members
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

  // Fetch governance body
  const { data: body, error } = await supabase
    .from("governance_bodies")
    .select(`
      id,
      name,
      slug,
      description,
      body_type,
      l10_required,
      is_confidential,
      settings,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !body) {
    return NextResponse.json({ error: "Governance body not found" }, { status: 404 });
  }

  // Fetch members with profile info
  const { data: memberships } = await supabase
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

  return NextResponse.json({
    ...body,
    members: memberships || [],
    member_count: memberships?.length || 0,
  });
}

/**
 * PATCH /api/governance-bodies/:id - Update a governance body
 */
export async function PATCH(req: Request, { params }: RouteParams) {
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

  const body = await req.json();
  const { name, slug, description, l10_required, is_confidential, settings } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (slug !== undefined) updateData.slug = slug;
  if (description !== undefined) updateData.description = description;
  if (l10_required !== undefined) updateData.l10_required = l10_required;
  if (is_confidential !== undefined) updateData.is_confidential = is_confidential;
  if (settings !== undefined) updateData.settings = settings;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("governance_bodies")
    .update(updateData)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .select()
    .single();

  if (error) {
    console.error("Error updating governance body:", error);
    if (error.code === "23505") {
      return NextResponse.json({ error: "A governance body with this slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update governance body" }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Governance body not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

/**
 * DELETE /api/governance-bodies/:id - Delete a governance body
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

  // Only admin can delete governance bodies
  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const { error } = await supabase
    .from("governance_bodies")
    .delete()
    .eq("id", id)
    .eq("organization_id", profile.organization_id);

  if (error) {
    console.error("Error deleting governance body:", error);
    return NextResponse.json({ error: "Failed to delete governance body" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
