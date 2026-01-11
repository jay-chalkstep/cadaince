import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { emitIntegrationEvent } from "@/lib/inngest/emit";

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
        assignment_type,
        assigned_at,
        team_member:profiles!seat_assignments_team_member_id_fkey(
          id, full_name, avatar_url, email, title
        )
      ),
      function_assignments:seat_function_assignments(
        id,
        assignment_type,
        sort_order,
        function:seat_functions!seat_function_assignments_function_id_fkey(
          id, name, description, category, icon, is_eos_default
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
    seat_type,
    eos_role,
    display_as_unit,
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

  // Validate parent seat if changing parent
  if (parent_seat_id !== undefined && parent_seat_id !== null) {
    // Check parent exists in same org
    const { data: parentSeat } = await supabase
      .from("seats")
      .select("id")
      .eq("id", parent_seat_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!parentSeat) {
      return NextResponse.json({ error: "Parent seat not found" }, { status: 400 });
    }

    // Check for circular hierarchy - new parent cannot be a descendant of this seat
    const { data: descendants } = await supabase.rpc("get_seat_descendants", {
      p_seat_id: id,
    });

    const descendantIds = new Set(
      descendants?.map((d: { id: string }) => d.id) || []
    );

    if (descendantIds.has(parent_seat_id)) {
      return NextResponse.json(
        { error: "Cannot set parent to a descendant (would create circular hierarchy)" },
        { status: 400 }
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (pillar_id !== undefined) updateData.pillar_id = pillar_id;
  if (parent_seat_id !== undefined) updateData.parent_seat_id = parent_seat_id;
  if (roles !== undefined) updateData.roles = roles;
  if (seat_type !== undefined) updateData.seat_type = seat_type;
  if (eos_role !== undefined) updateData.eos_role = eos_role;
  if (display_as_unit !== undefined) updateData.display_as_unit = display_as_unit;
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
        assignment_type,
        team_member:profiles!seat_assignments_team_member_id_fkey(
          id, full_name, avatar_url
        )
      ),
      function_assignments:seat_function_assignments(
        id,
        assignment_type,
        sort_order,
        function:seat_functions!seat_function_assignments_function_id_fkey(
          id, name, description, category, icon, is_eos_default
        )
      )
    `)
    .single();

  if (error) {
    console.error("Error updating seat:", error);
    return NextResponse.json({ error: "Failed to update seat" }, { status: 500 });
  }

  // Emit event to trigger team sync (only for hierarchy-affecting changes)
  const hierarchyFields = ["name", "parent_seat_id", "eos_role", "pillar_id"];
  const hasHierarchyChanges = hierarchyFields.some((f) => f in updateData);
  if (hasHierarchyChanges) {
    await emitIntegrationEvent("accountability-chart/changed", {
      organization_id: profile.organization_id,
      action: "seat_updated",
      seat_id: id,
    });
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

  // Orphan any child seats (set their parent to null) before deleting
  const { error: orphanError } = await supabase
    .from("seats")
    .update({ parent_seat_id: null })
    .eq("parent_seat_id", id)
    .eq("organization_id", profile.organization_id);

  if (orphanError) {
    console.error("Error orphaning child seats:", orphanError);
    return NextResponse.json({ error: "Failed to reassign child seats" }, { status: 500 });
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

  // Emit event to trigger team sync
  await emitIntegrationEvent("accountability-chart/changed", {
    organization_id: profile.organization_id,
    action: "seat_deleted",
    seat_id: id,
  });

  return NextResponse.json({ success: true });
}
