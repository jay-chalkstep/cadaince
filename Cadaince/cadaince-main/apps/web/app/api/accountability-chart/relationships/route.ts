import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/accountability-chart/relationships - Get all relationships for org
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { data: relationships, error } = await supabase
    .from("seat_relationships")
    .select(`
      *,
      from_seat:seats!seat_relationships_from_seat_id_fkey(id, name),
      to_seat:seats!seat_relationships_to_seat_id_fkey(id, name)
    `)
    .eq("organization_id", profile.organization_id)
    .order("created_at");

  if (error) {
    console.error("Error fetching relationships:", error);
    return NextResponse.json({ error: "Failed to fetch relationships" }, { status: 500 });
  }

  return NextResponse.json(relationships || []);
}

// POST /api/accountability-chart/relationships - Create a relationship
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin and ELT can create relationships
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { from_seat_id, to_seat_id, relationship_type, description } = body;

  if (!from_seat_id || !to_seat_id || !relationship_type) {
    return NextResponse.json(
      { error: "from_seat_id, to_seat_id, and relationship_type are required" },
      { status: 400 }
    );
  }

  if (from_seat_id === to_seat_id) {
    return NextResponse.json(
      { error: "Cannot create relationship to self" },
      { status: 400 }
    );
  }

  // Verify both seats exist in this org
  const { data: seats } = await supabase
    .from("seats")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .in("id", [from_seat_id, to_seat_id]);

  if (!seats || seats.length !== 2) {
    return NextResponse.json({ error: "One or both seats not found" }, { status: 404 });
  }

  const { data: relationship, error } = await supabase
    .from("seat_relationships")
    .insert({
      organization_id: profile.organization_id,
      from_seat_id,
      to_seat_id,
      relationship_type,
      description: description || null,
    })
    .select(`
      *,
      from_seat:seats!seat_relationships_from_seat_id_fkey(id, name),
      to_seat:seats!seat_relationships_to_seat_id_fkey(id, name)
    `)
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This relationship already exists" },
        { status: 409 }
      );
    }
    console.error("Error creating relationship:", error);
    return NextResponse.json({ error: "Failed to create relationship" }, { status: 500 });
  }

  return NextResponse.json(relationship, { status: 201 });
}
