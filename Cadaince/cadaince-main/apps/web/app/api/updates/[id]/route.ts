import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/updates/:id - Get single update
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

  const { data: update, error } = await supabase
    .from("updates")
    .select(`
      *,
      author:profiles!updates_author_id_fkey(id, full_name, avatar_url, role, email),
      linked_rock:rocks(id, title, status, description),
      linked_metric:metrics(id, name, goal, unit)
    `)
    .eq("id", id)
    .single();

  if (error || !update) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  return NextResponse.json(update);
}

// PATCH /api/updates/:id - Update an update
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

  // Get the update to check ownership
  const { data: update } = await supabase
    .from("updates")
    .select("author_id")
    .eq("id", id)
    .single();

  if (!update) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  // Only author or admin can update
  if (update.author_id !== profile.id && profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    type,
    content,
    video_url,
    video_asset_id,
    thumbnail_url,
    transcript,
    duration_seconds,
    linked_rock_id,
    linked_metric_id,
    is_draft,
  } = body;

  const updateData: Record<string, unknown> = {};
  if (type !== undefined) updateData.type = type;
  if (content !== undefined) updateData.content = content;
  if (video_url !== undefined) updateData.video_url = video_url;
  if (video_asset_id !== undefined) updateData.video_asset_id = video_asset_id;
  if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url;
  if (transcript !== undefined) updateData.transcript = transcript;
  if (duration_seconds !== undefined) updateData.duration_seconds = duration_seconds;
  if (linked_rock_id !== undefined) updateData.linked_rock_id = linked_rock_id;
  if (linked_metric_id !== undefined) updateData.linked_metric_id = linked_metric_id;
  if (is_draft !== undefined) {
    updateData.is_draft = is_draft;
    // Set published_at when publishing
    if (!is_draft) {
      updateData.published_at = new Date().toISOString();
    }
  }

  const { data: updated, error } = await supabase
    .from("updates")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      author:profiles!updates_author_id_fkey(id, full_name, avatar_url, role)
    `)
    .single();

  if (error) {
    console.error("Error updating update:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/updates/:id - Delete update
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

  // Get the update to check ownership
  const { data: update } = await supabase
    .from("updates")
    .select("author_id")
    .eq("id", id)
    .single();

  if (!update) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  // Only author or admin can delete
  if (update.author_id !== profile.id && profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("updates").delete().eq("id", id);

  if (error) {
    console.error("Error deleting update:", error);
    return NextResponse.json({ error: "Failed to delete update" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
