import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// DELETE /api/accountability-chart/seats/:id/assign/:memberId - Unassign team member
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: seatId, memberId } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin and ELT can unassign
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const { error } = await supabase
    .from("seat_assignments")
    .delete()
    .eq("seat_id", seatId)
    .eq("team_member_id", memberId);

  if (error) {
    console.error("Error unassigning team member:", error);
    return NextResponse.json({ error: "Failed to unassign team member" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
