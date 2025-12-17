import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/rocks/:id - Get single rock
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

  const { data: rock, error } = await supabase
    .from("rocks")
    .select(`
      *,
      owner:profiles!rocks_owner_id_fkey(id, full_name, avatar_url, email),
      pillar:pillars!rocks_pillar_id_fkey(id, name)
    `)
    .eq("id", id)
    .single();

  if (error || !rock) {
    return NextResponse.json({ error: "Rock not found" }, { status: 404 });
  }

  // Get related milestones
  const { data: milestones } = await supabase
    .from("milestones")
    .select("*")
    .eq("rock_id", id)
    .order("due_date", { ascending: true });

  return NextResponse.json({
    ...rock,
    milestones: milestones || [],
  });
}

// PATCH /api/rocks/:id - Update rock
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

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get the rock to check ownership
  const { data: rock } = await supabase
    .from("rocks")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!rock) {
    return NextResponse.json({ error: "Rock not found" }, { status: 404 });
  }

  // Check if user is admin, elt, or owner
  const isAdmin = profile.access_level === "admin";
  const isElt = profile.access_level === "elt";
  const isOwner = rock.owner_id === profile.id;

  if (!isAdmin && !isElt && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, pillar_id, owner_id, status, quarter, year } = body;

  const { data: updated, error } = await supabase
    .from("rocks")
    .update({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(pillar_id !== undefined && { pillar_id }),
      ...(owner_id !== undefined && { owner_id }),
      ...(status !== undefined && { status }),
      ...(quarter !== undefined && { quarter }),
      ...(year !== undefined && { year }),
    })
    .eq("id", id)
    .select(`
      *,
      owner:profiles!rocks_owner_id_fkey(id, full_name, avatar_url),
      pillar:pillars!rocks_pillar_id_fkey(id, name)
    `)
    .single();

  if (error) {
    console.error("Error updating rock:", error);
    return NextResponse.json({ error: "Failed to update rock" }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/rocks/:id - Delete rock
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

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("rocks").delete().eq("id", id);

  if (error) {
    console.error("Error deleting rock:", error);
    return NextResponse.json({ error: "Failed to delete rock" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
