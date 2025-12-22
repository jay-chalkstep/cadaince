import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/accountability-chart/seats/:id/functions - Get functions assigned to seat
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

  // Verify seat exists in this org
  const { data: seat } = await supabase
    .from("seats")
    .select("id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!seat) {
    return NextResponse.json({ error: "Seat not found" }, { status: 404 });
  }

  // Get functions assigned to this seat
  const { data: assignments, error } = await supabase
    .from("seat_function_assignments")
    .select(`
      id,
      assignment_type,
      sort_order,
      function:seat_functions!seat_function_assignments_function_id_fkey(
        id, name, description, category, icon, is_eos_default, is_custom
      )
    `)
    .eq("seat_id", id)
    .order("sort_order")
    .order("created_at");

  if (error) {
    console.error("Error fetching seat functions:", error);
    return NextResponse.json({ error: "Failed to fetch functions" }, { status: 500 });
  }

  return NextResponse.json(assignments || []);
}

// POST /api/accountability-chart/seats/:id/functions - Assign function to seat
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

  // Only admin and ELT can assign functions
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

  const body = await req.json();
  const { function_id, assignment_type, sort_order } = body;

  if (!function_id) {
    return NextResponse.json({ error: "function_id is required" }, { status: 400 });
  }

  // Verify function exists in this org
  const { data: fn } = await supabase
    .from("seat_functions")
    .select("id")
    .eq("id", function_id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!fn) {
    return NextResponse.json({ error: "Function not found" }, { status: 404 });
  }

  // Get next sort_order if not provided
  let finalSortOrder = sort_order;
  if (finalSortOrder === undefined) {
    const { data: lastAssignment } = await supabase
      .from("seat_function_assignments")
      .select("sort_order")
      .eq("seat_id", seatId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    finalSortOrder = (lastAssignment?.sort_order || 0) + 1;
  }

  // Upsert the assignment
  const { data: assignment, error } = await supabase
    .from("seat_function_assignments")
    .upsert(
      {
        seat_id: seatId,
        function_id,
        assignment_type: assignment_type || "primary",
        sort_order: finalSortOrder,
      },
      { onConflict: "seat_id,function_id" }
    )
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
    console.error("Error assigning function:", error);
    return NextResponse.json({ error: "Failed to assign function" }, { status: 500 });
  }

  return NextResponse.json(assignment, { status: 201 });
}
