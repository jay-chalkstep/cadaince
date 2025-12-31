import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/updates/:id/archive - Archive update
export async function POST(
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

  // Get the update to check if it exists and ownership
  const { data: update } = await supabase
    .from("updates")
    .select("id, author_id, archived_at")
    .eq("id", id)
    .single();

  if (!update) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  // Only author or admin can archive
  if (update.author_id !== profile.id && profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (update.archived_at) {
    return NextResponse.json({ error: "Update is already archived" }, { status: 400 });
  }

  const { error } = await supabase
    .from("updates")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: profile.id,
    })
    .eq("id", id);

  if (error) {
    console.error("Error archiving update:", error);
    return NextResponse.json({ error: "Failed to archive" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/updates/:id/archive - Unarchive update
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
    .select("id, author_id, archived_at")
    .eq("id", id)
    .single();

  if (!update) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  // Only author or admin can unarchive
  if (update.author_id !== profile.id && profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!update.archived_at) {
    return NextResponse.json({ error: "Update is not archived" }, { status: 400 });
  }

  const { error } = await supabase
    .from("updates")
    .update({
      archived_at: null,
      archived_by: null,
    })
    .eq("id", id);

  if (error) {
    console.error("Error unarchiving update:", error);
    return NextResponse.json({ error: "Failed to unarchive" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
