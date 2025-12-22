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

  // Get all seats with assignments and functions
  const { data: seats, error } = await supabase
    .from("seats")
    .select(`
      *,
      pillar:pillars!seats_pillar_id_fkey(id, name, color),
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

  // Build hierarchical structure
  const seatsById = new Map(seats?.map(s => [s.id, { ...s, children: [] as typeof seats }]) || []);
  const rootSeats: typeof seats = [];

  seats?.forEach(seat => {
    if (seat.parent_seat_id && seatsById.has(seat.parent_seat_id)) {
      seatsById.get(seat.parent_seat_id)!.children.push(seatsById.get(seat.id)!);
    } else {
      rootSeats.push(seatsById.get(seat.id)!);
    }
  });

  return NextResponse.json({
    seats: rootSeats,
    flatSeats: seats || [],
    relationships: relationships || [],
  });
}
