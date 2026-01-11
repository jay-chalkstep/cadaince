import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/accountability-chart - Get full org chart
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Get all seats with assignments, functions, and pillars (multi-pillar support)
  const { data: seats, error } = await supabase
    .from("seats")
    .select(`
      *,
      pillar:pillars!seats_pillar_id_fkey(id, name, color),
      seat_pillars(
        id,
        is_primary,
        pillar:pillars!seat_pillars_pillar_id_fkey(id, name, color)
      ),
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
    .eq("organization_id", profile.organization_id)
    .order("name");

  // Get all relationships
  const { data: relationships } = await supabase
    .from("seat_relationships")
    .select(`
      *,
      from_seat:seats!seat_relationships_from_seat_id_fkey(id, name),
      to_seat:seats!seat_relationships_to_seat_id_fkey(id, name)
    `)
    .eq("organization_id", profile.organization_id);

  if (error) {
    console.error("Error fetching seats:", error);
    return NextResponse.json({ error: "Failed to fetch accountability chart" }, { status: 500 });
  }

  // Transform seat_pillars into pillars array for each seat
  const transformedSeats = seats?.map(seat => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seatPillars = (seat as any).seat_pillars || [];
    const pillars = seatPillars
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((sp: any) => ({
        id: sp.pillar?.id,
        name: sp.pillar?.name,
        color: sp.pillar?.color,
        is_primary: sp.is_primary,
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p: any) => p.id) // Filter out any with missing pillar data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => {
        // Primary pillar first, then alphabetically
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return a.name?.localeCompare(b.name || '') || 0;
      });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { seat_pillars: _seatPillars, ...seatWithoutJunction } = seat as typeof seat & { seat_pillars?: unknown };
    return {
      ...seatWithoutJunction,
      pillars,
    };
  }) || [];

  // Build hierarchical structure
  const seatsById = new Map(transformedSeats.map(s => [s.id, { ...s, children: [] as typeof transformedSeats }]));
  const rootSeats: typeof transformedSeats = [];

  transformedSeats.forEach(seat => {
    if (seat.parent_seat_id && seatsById.has(seat.parent_seat_id)) {
      seatsById.get(seat.parent_seat_id)!.children.push(seatsById.get(seat.id)!);
    } else {
      rootSeats.push(seatsById.get(seat.id)!);
    }
  });

  return NextResponse.json({
    seats: rootSeats,
    flatSeats: transformedSeats,
    relationships: relationships || [],
  });
}
