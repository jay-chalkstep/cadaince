import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/accountability-chart/functions/:id - Get single function
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

  const { data: fn, error } = await supabase
    .from("seat_functions")
    .select(`
      *,
      assignments:seat_function_assignments(
        id,
        seat_id,
        assignment_type,
        sort_order,
        seat:seats!seat_function_assignments_seat_id_fkey(id, name)
      )
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !fn) {
    return NextResponse.json({ error: "Function not found" }, { status: 404 });
  }

  return NextResponse.json(fn);
}

// PATCH /api/accountability-chart/functions/:id - Update function
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

  // Only admin and ELT can update functions
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify function exists in this org
  const { data: existingFn } = await supabase
    .from("seat_functions")
    .select("id, is_eos_default")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!existingFn) {
    return NextResponse.json({ error: "Function not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, description, category, icon, is_hidden, sort_order } = body;

  // EOS defaults can only be hidden, not fully edited
  if (existingFn.is_eos_default) {
    const updateData: Record<string, unknown> = {};
    if (is_hidden !== undefined) updateData.is_hidden = is_hidden;
    if (sort_order !== undefined) updateData.sort_order = sort_order;

    const { data: fn, error } = await supabase
      .from("seat_functions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating function:", error);
      return NextResponse.json({ error: "Failed to update function" }, { status: 500 });
    }

    return NextResponse.json(fn);
  }

  // Custom functions can be fully edited
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (category !== undefined) updateData.category = category;
  if (icon !== undefined) updateData.icon = icon;
  if (is_hidden !== undefined) updateData.is_hidden = is_hidden;
  if (sort_order !== undefined) updateData.sort_order = sort_order;

  const { data: fn, error } = await supabase
    .from("seat_functions")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating function:", error);
    return NextResponse.json({ error: "Failed to update function" }, { status: 500 });
  }

  return NextResponse.json(fn);
}

// DELETE /api/accountability-chart/functions/:id - Delete function
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

  // Only admin can delete functions
  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify function exists and is custom (not EOS default)
  const { data: existingFn } = await supabase
    .from("seat_functions")
    .select("id, is_eos_default")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!existingFn) {
    return NextResponse.json({ error: "Function not found" }, { status: 404 });
  }

  if (existingFn.is_eos_default) {
    return NextResponse.json(
      { error: "Cannot delete EOS default functions. You can hide them instead." },
      { status: 400 }
    );
  }

  // Delete function (cascade will remove assignments)
  const { error } = await supabase
    .from("seat_functions")
    .delete()
    .eq("id", id)
    .eq("organization_id", profile.organization_id);

  if (error) {
    console.error("Error deleting function:", error);
    return NextResponse.json({ error: "Failed to delete function" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
