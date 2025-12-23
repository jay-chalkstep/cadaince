import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/issues/:id - Get single issue
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

  const { data: issue, error } = await supabase
    .from("issues")
    .select(`
      *,
      owner:profiles!issues_owner_id_fkey(id, full_name, avatar_url, email),
      created_by_profile:profiles!issues_created_by_fkey(id, full_name, avatar_url),
      linked_rock:rocks(id, title, status)
    `)
    .eq("id", id)
    .single();

  if (error || !issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  return NextResponse.json(issue);
}

// PATCH /api/issues/:id - Update issue
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

  // Get the issue to check ownership
  const { data: issue } = await supabase
    .from("issues")
    .select("owner_id, created_by, resolved_at")
    .eq("id", id)
    .single();

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  // Check if user is admin, owner, or creator
  const isAdmin = profile.access_level === "admin";
  const isOwner = issue.owner_id === profile.id;
  const isCreator = issue.created_by === profile.id;

  if (!isAdmin && !isOwner && !isCreator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, owner_id, priority, status, resolution, linked_rock_id } = body;

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (owner_id !== undefined) updateData.owner_id = owner_id;
  if (priority !== undefined) updateData.priority = priority;
  if (status !== undefined) updateData.status = status;
  if (resolution !== undefined) updateData.resolution = resolution;
  if (linked_rock_id !== undefined) updateData.linked_rock_id = linked_rock_id;

  // Set resolved_at when status changes to resolved
  if (status === "resolved" && !issue.resolved_at) {
    updateData.resolved_at = new Date().toISOString();
  }

  const { data: updated, error } = await supabase
    .from("issues")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      owner:profiles!issues_owner_id_fkey(id, full_name, avatar_url),
      created_by_profile:profiles!issues_created_by_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error updating issue:", error);
    return NextResponse.json({ error: "Failed to update issue" }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/issues/:id - Delete issue
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

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get the issue to check ownership
  const { data: issue } = await supabase
    .from("issues")
    .select("created_by")
    .eq("id", id)
    .single();

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  // Only admin or creator can delete
  if (profile.access_level !== "admin" && issue.created_by !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("issues").delete().eq("id", id);

  if (error) {
    console.error("Error deleting issue:", error);
    return NextResponse.json({ error: "Failed to delete issue" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
