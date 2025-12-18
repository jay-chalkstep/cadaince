import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/team/[id] - Get a single team member
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

  const { data: member, error } = await supabase
    .from("profiles")
    .select(`
      *,
      pillar:pillars!profiles_pillar_id_fkey(id, name, slug, color)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching team member:", error);
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  }

  return NextResponse.json(member);
}

// PUT /api/team/[id] - Update a team member
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Check if user is admin or updating themselves
  const { data: currentUser } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  const isAdmin = currentUser?.access_level === "admin";
  const isSelf = currentUser?.id === id;

  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  // Non-admins can only update certain fields
  const allowedFieldsSelf = [
    "avatar_url",
    "receives_briefing",
    "briefing_time",
    "timezone",
  ];

  const allowedFieldsAdmin = [
    ...allowedFieldsSelf,
    "full_name",
    "title",
    "role",
    "access_level",
    "pillar_id",
    "is_pillar_lead",
    "responsibilities",
    "status",
  ];

  const allowedFields = isAdmin ? allowedFieldsAdmin : allowedFieldsSelf;
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: member, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select(`
      *,
      pillar:pillars!profiles_pillar_id_fkey(id, name, slug, color)
    `)
    .single();

  if (error) {
    console.error("Error updating team member:", error);
    return NextResponse.json({ error: "Failed to update team member" }, { status: 500 });
  }

  return NextResponse.json(member);
}

// DELETE /api/team/[id] - Deactivate a team member (admin only)
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
  const { data: currentUser } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!currentUser || currentUser.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  // Don't allow deleting yourself
  if (currentUser.id === id) {
    return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
  }

  // Soft delete by setting status to inactive
  const { error } = await supabase
    .from("profiles")
    .update({ status: "inactive" })
    .eq("id", id);

  if (error) {
    console.error("Error deactivating team member:", error);
    return NextResponse.json({ error: "Failed to deactivate team member" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
