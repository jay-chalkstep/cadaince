import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// PATCH /api/one-on-one-topics/[id] - Update a topic
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

  // Get topic and verify access
  const { data: existingTopic } = await supabase
    .from("one_on_one_topics")
    .select(`
      *,
      meeting:one_on_one_meetings!one_on_one_topics_meeting_id_fkey(manager_id, direct_id)
    `)
    .eq("id", id)
    .single();

  if (!existingTopic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // Check access: participant or admin
  const meeting = existingTopic.meeting;
  if (
    meeting.manager_id !== profile.id &&
    meeting.direct_id !== profile.id &&
    profile.access_level !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, notes, status, discussed_in_instance_id } = body;

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (notes !== undefined) updateData.notes = notes;
  if (status !== undefined) updateData.status = status;
  if (discussed_in_instance_id !== undefined) {
    updateData.discussed_in_instance_id = discussed_in_instance_id;
  }

  const { data: topic, error } = await supabase
    .from("one_on_one_topics")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      added_by:profiles!one_on_one_topics_added_by_id_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error updating 1:1 topic:", error);
    return NextResponse.json({ error: "Failed to update topic" }, { status: 500 });
  }

  return NextResponse.json(topic);
}

// DELETE /api/one-on-one-topics/[id] - Delete a topic
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

  // Get topic to check ownership
  const { data: existingTopic } = await supabase
    .from("one_on_one_topics")
    .select("added_by_id")
    .eq("id", id)
    .single();

  if (!existingTopic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // Only the creator or admin can delete
  if (existingTopic.added_by_id !== profile.id && profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("one_on_one_topics")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting 1:1 topic:", error);
    return NextResponse.json({ error: "Failed to delete topic" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
