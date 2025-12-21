import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/accountability-chart/seats/:id - Get single seat
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
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { data: seat, error } = await supabase
    .from("seats")
    .select(`
      *,
      pillar:pillars!seats_pillar_id_fkey(id, name, color),
      parent:seats!seats_parent_seat_id_fkey(id, name),
      assignments:seat_assignments(
        id,
        is_primary,
        assigned_at,
        team_member:profiles!seat_assignments_team_member_id_fkey(
          id, full_name, avatar_url, email, title
        )
      )
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !seat) {
    return NextResponse.json({ error: "Seat not found" }, { status: 404 });
  }

  return NextResponse.json(seat);
}

// PATCH /api/accountability-chart/seats/:id - Update seat
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

  // Only admin and ELT can update seats
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify seat exists in this org
  const { data: existingSeat } = await supabase
    .from("seats")
    .select("id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!existingSeat) {
    return NextResponse.json({ error: "Seat not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    name,
    pillar_id,
    parent_seat_id,
    roles,
    core_values_match,
    gets_it,
    wants_it,
    capacity_to_do,
    position_x,
    position_y,
    color,
  } = body;

  // Prevent circular parent reference
  if (parent_seat_id === id) {
    return NextResponse.json({ error: "Seat cannot be its own parent" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (pillar_id !== undefined) updateData.pillar_id = pillar_id;
  if (parent_seat_id !== undefined) updateData.parent_seat_id = parent_seat_id;
  if (roles !== undefined) updateData.roles = roles;
  if (core_values_match !== undefined) updateData.core_values_match = core_values_match;
  if (gets_it !== undefined) updateData.gets_it = gets_it;
  if (wants_it !== undefined) updateData.wants_it = wants_it;
  if (capacity_to_do !== undefined) updateData.capacity_to_do = capacity_to_do;
  if (position_x !== undefined) updateData.position_x = position_x;
  if (position_y !== undefined) updateData.position_y = position_y;
  if (color !== undefined) updateData.color = color;

  const { data: seat, error } = await supabase
    .from("seats")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      pillar:pillars!seats_pillar_id_fkey(id, name, color),
      assignments:seat_assignments(
        id,
        is_primary,
        team_member:profiles!seat_assignments_team_member_id_fkey(
          id, full_name, avatar_url
        )
      )
    `)
    .single();

  if (error) {
    console.error("Error updating seat:", error);
    return NextResponse.json({ error: "Failed to update seat" }, { status: 500 });
  }

  return NextResponse.json(seat);
}

// DELETE /api/accountability-chart/seats/:id - Delete seat
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin can delete seats
  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if seat has children
  const { data: children } = await supabase
    .from("seats")
    .select("id")
    .eq("parent_seat_id", id)
    .limit(1);

  if (children && children.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete seat with child seats. Delete or reassign children first." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("seats")
    .delete()
    .eq("id", id)
    .eq("organization_id", profile.organization_id);

  if (error) {
    console.error("Error deleting seat:", error);
    return NextResponse.json({ error: "Failed to delete seat" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
