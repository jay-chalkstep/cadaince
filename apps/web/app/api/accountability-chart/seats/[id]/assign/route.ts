import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/accountability-chart/seats/:id/assign - Assign team member to seat
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: seatId } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin and ELT can assign
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { team_member_id, is_primary } = body;

  if (!team_member_id) {
    return NextResponse.json({ error: "team_member_id is required" }, { status: 400 });
  }

  // Verify seat exists in this org
  const { data: seat } = await supabase
    .from("seats")
    .select("id")
    .eq("id", seatId)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!seat) {
    return NextResponse.json({ error: "Seat not found" }, { status: 404 });
  }

  // Verify team member exists in this org
  const { data: member } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", team_member_id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  }

  // Create assignment (upsert to handle re-assignment)
  const { data: assignment, error } = await supabase
    .from("seat_assignments")
    .upsert({
      seat_id: seatId,
      team_member_id,
      is_primary: is_primary ?? true,
    }, {
      onConflict: "seat_id,team_member_id",
    })
    .select(`
      id,
      is_primary,
      assigned_at,
      team_member:profiles!seat_assignments_team_member_id_fkey(
        id, full_name, avatar_url, email, title
      )
    `)
    .single();

  if (error) {
    console.error("Error assigning team member:", error);
    return NextResponse.json({ error: "Failed to assign team member" }, { status: 500 });
  }

  return NextResponse.json(assignment, { status: 201 });
}
