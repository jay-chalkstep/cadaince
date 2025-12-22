import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/accountability-chart/relationships/:id - Get single relationship
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

  const { data: relationship, error } = await supabase
    .from("seat_relationships")
    .select(`
      *,
      from_seat:seats!seat_relationships_from_seat_id_fkey(id, name),
      to_seat:seats!seat_relationships_to_seat_id_fkey(id, name)
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !relationship) {
    return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
  }

  return NextResponse.json(relationship);
}

// PATCH /api/accountability-chart/relationships/:id - Update relationship
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

  // Only admin and ELT can update relationships
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify relationship exists in this org
  const { data: existingRel } = await supabase
    .from("seat_relationships")
    .select("id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!existingRel) {
    return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
  }

  const body = await req.json();
  const { relationship_type, description } = body;

  const updateData: Record<string, unknown> = {};
  if (relationship_type !== undefined) updateData.relationship_type = relationship_type;
  if (description !== undefined) updateData.description = description;

  const { data: relationship, error } = await supabase
    .from("seat_relationships")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      from_seat:seats!seat_relationships_from_seat_id_fkey(id, name),
      to_seat:seats!seat_relationships_to_seat_id_fkey(id, name)
    `)
    .single();

  if (error) {
    console.error("Error updating relationship:", error);
    return NextResponse.json({ error: "Failed to update relationship" }, { status: 500 });
  }

  return NextResponse.json(relationship);
}

// DELETE /api/accountability-chart/relationships/:id - Delete relationship
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

  // Only admin and ELT can delete relationships
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("seat_relationships")
    .delete()
    .eq("id", id)
    .eq("organization_id", profile.organization_id);

  if (error) {
    console.error("Error deleting relationship:", error);
    return NextResponse.json({ error: "Failed to delete relationship" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
