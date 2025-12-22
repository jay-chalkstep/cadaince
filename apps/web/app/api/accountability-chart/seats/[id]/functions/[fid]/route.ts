import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// PATCH /api/accountability-chart/seats/:id/functions/:fid - Update function assignment
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; fid: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: seatId, fid: functionId } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin and ELT can update function assignments
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

  // Verify assignment exists
  const { data: existingAssignment } = await supabase
    .from("seat_function_assignments")
    .select("id")
    .eq("seat_id", seatId)
    .eq("function_id", functionId)
    .single();

  if (!existingAssignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const body = await req.json();
  const { assignment_type, sort_order } = body;

  const updateData: Record<string, unknown> = {};
  if (assignment_type !== undefined) updateData.assignment_type = assignment_type;
  if (sort_order !== undefined) updateData.sort_order = sort_order;

  const { data: assignment, error } = await supabase
    .from("seat_function_assignments")
    .update(updateData)
    .eq("seat_id", seatId)
    .eq("function_id", functionId)
    .select(`
      id,
      assignment_type,
      sort_order,
      function:seat_functions!seat_function_assignments_function_id_fkey(
        id, name, description, category, icon, is_eos_default, is_custom
      )
    `)
    .single();

  if (error) {
    console.error("Error updating assignment:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }

  return NextResponse.json(assignment);
}

// DELETE /api/accountability-chart/seats/:id/functions/:fid - Remove function from seat
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; fid: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: seatId, fid: functionId } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin and ELT can remove function assignments
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
    .from("seat_function_assignments")
    .delete()
    .eq("seat_id", seatId)
    .eq("function_id", functionId);

  if (error) {
    console.error("Error removing assignment:", error);
    return NextResponse.json({ error: "Failed to remove function" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
