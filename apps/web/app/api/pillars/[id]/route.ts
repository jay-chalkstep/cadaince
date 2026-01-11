import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/pillars/[id] - Get a single pillar with members
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

  const { data: pillar, error } = await supabase
    .from("pillars")
    .select(`
      id,
      name,
      slug,
      description,
      color,
      sort_order,
      anchor_seat_id,
      leader:profiles!pillars_leader_id_fkey(id, full_name, avatar_url, title),
      anchor_seat:seats!pillars_anchor_seat_id_fkey(id, name, eos_role)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching pillar:", error);
    return NextResponse.json({ error: "Pillar not found" }, { status: 404 });
  }

  // Get computed members from pillar_memberships view (derived from AC)
  const { data: computedMemberships } = await supabase
    .from("pillar_memberships")
    .select("profile_id, is_lead")
    .eq("pillar_id", id);

  let computed_members: Array<{
    profile_id: string;
    is_lead: boolean;
    profile: {
      id: string;
      full_name: string;
      avatar_url: string | null;
      title: string | null;
      access_level: string;
    } | null;
  }> = [];

  if (computedMemberships && computedMemberships.length > 0) {
    const profileIds = computedMemberships.map(m => m.profile_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, title, access_level")
      .in("id", profileIds);

    computed_members = computedMemberships.map(m => ({
      ...m,
      profile: profiles?.find(p => p.id === m.profile_id) || null,
    }));
  }

  // Also get legacy members (from profiles.pillar_id)
  const { data: legacyMembers } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, title, role, access_level, is_pillar_lead")
    .eq("pillar_id", id)
    .eq("status", "active")
    .order("is_pillar_lead", { ascending: false })
    .order("full_name", { ascending: true });

  return NextResponse.json({
    ...pillar,
    computed_members,
    members: legacyMembers || [], // Legacy support
  });
}

// PUT /api/pillars/[id] - Update a pillar (admin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { name, slug, description, color, sort_order, leader_id, anchor_seat_id } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (slug !== undefined) updates.slug = slug;
  if (description !== undefined) updates.description = description;
  if (color !== undefined) updates.color = color;
  if (sort_order !== undefined) updates.sort_order = sort_order;
  if (leader_id !== undefined) updates.leader_id = leader_id;
  if (anchor_seat_id !== undefined) updates.anchor_seat_id = anchor_seat_id;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // If leader is being set, update the is_pillar_lead flag
  if (leader_id) {
    // First, remove pillar lead status from current lead
    await supabase
      .from("profiles")
      .update({ is_pillar_lead: false })
      .eq("pillar_id", id)
      .eq("is_pillar_lead", true);

    // Set new leader
    await supabase
      .from("profiles")
      .update({ is_pillar_lead: true })
      .eq("id", leader_id);
  }

  const { data: pillar, error } = await supabase
    .from("pillars")
    .update(updates)
    .eq("id", id)
    .select(`
      id,
      name,
      slug,
      description,
      color,
      sort_order,
      anchor_seat_id,
      leader:profiles!pillars_leader_id_fkey(id, full_name, avatar_url),
      anchor_seat:seats!pillars_anchor_seat_id_fkey(id, name, eos_role)
    `)
    .single();

  if (error) {
    console.error("Error updating pillar:", error);
    return NextResponse.json({ error: "Failed to update pillar" }, { status: 500 });
  }

  return NextResponse.json(pillar);
}

// DELETE /api/pillars/[id] - Delete a pillar (admin only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  // Check if pillar has members
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("pillar_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "Cannot delete pillar with assigned team members" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("pillars")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting pillar:", error);
    return NextResponse.json({ error: "Failed to delete pillar" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
