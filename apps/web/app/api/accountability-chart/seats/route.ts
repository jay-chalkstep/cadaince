import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { emitIntegrationEvent } from "@/lib/inngest/emit";

// POST /api/accountability-chart/seats - Create a new seat
export async function POST(req: Request) {
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

  // Only admin and ELT can create seats
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name,
    pillar_id,
    pillar_ids, // Multi-pillar support
    primary_pillar_id, // Which pillar is primary
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

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Validate parent_seat_id is in same org
  if (parent_seat_id) {
    const { data: parentSeat } = await supabase
      .from("seats")
      .select("id")
      .eq("id", parent_seat_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!parentSeat) {
      return NextResponse.json({ error: "Parent seat not found" }, { status: 400 });
    }
  }

  // Determine which pillar IDs to use (multi-pillar or legacy single)
  const effectivePillarIds: string[] = pillar_ids?.length > 0
    ? pillar_ids
    : (pillar_id ? [pillar_id] : []);

  // For backward compat, set legacy pillar_id to primary or first pillar
  const legacyPillarId = primary_pillar_id || effectivePillarIds[0] || null;

  const { data: seat, error } = await supabase
    .from("seats")
    .insert({
      organization_id: profile.organization_id,
      name,
      pillar_id: legacyPillarId, // Backward compat
      parent_seat_id: parent_seat_id || null,
      roles: roles || [],
      seat_type: seat_type || "single",
      eos_role: eos_role || null,
      display_as_unit: display_as_unit ?? false,
      core_values_match: core_values_match ?? true,
      gets_it: gets_it ?? true,
      wants_it: wants_it ?? true,
      capacity_to_do: capacity_to_do ?? true,
      position_x: position_x ?? 0,
      position_y: position_y ?? 0,
      color: color || null,
    })
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
      )
    `)
    .single();

  if (error) {
    console.error("Error creating seat:", error);
    return NextResponse.json({ error: "Failed to create seat" }, { status: 500 });
  }

  // Insert into seat_pillars junction table (multi-pillar support)
  if (effectivePillarIds.length > 0) {
    const seatPillarInserts = effectivePillarIds.map(pId => ({
      seat_id: seat.id,
      pillar_id: pId,
      is_primary: pId === (primary_pillar_id || effectivePillarIds[0]),
    }));

    const { error: pillarError } = await supabase
      .from("seat_pillars")
      .insert(seatPillarInserts);

    if (pillarError) {
      console.error("Error inserting seat pillars:", pillarError);
      // Don't fail the whole request, seat was created successfully
    }
  }

  // Fetch pillars for response
  const { data: seatPillars } = await supabase
    .from("seat_pillars")
    .select(`
      id,
      is_primary,
      pillar:pillars!seat_pillars_pillar_id_fkey(id, name, color)
    `)
    .eq("seat_id", seat.id);

  // Transform pillars for response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pillars = (seatPillars || []).map((sp: any) => ({
    id: sp.pillar?.id,
    name: sp.pillar?.name,
    color: sp.pillar?.color,
    is_primary: sp.is_primary,
  })).filter((p: { id: string | undefined }) => p.id);

  // Emit event to trigger team sync
  await emitIntegrationEvent("accountability-chart/changed", {
    organization_id: profile.organization_id,
    action: "seat_created",
    seat_id: seat.id,
  });

  return NextResponse.json({ ...seat, pillars }, { status: 201 });
}
