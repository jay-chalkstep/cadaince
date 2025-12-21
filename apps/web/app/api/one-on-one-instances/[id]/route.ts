import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/one-on-one-instances/[id] - Get a single instance with context
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

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get instance with meeting info
  const { data: instance, error } = await supabase
    .from("one_on_one_instances")
    .select(`
      *,
      meeting:one_on_one_meetings!one_on_one_instances_meeting_id_fkey(
        *,
        manager:profiles!one_on_one_meetings_manager_id_fkey(id, full_name, avatar_url, title),
        direct:profiles!one_on_one_meetings_direct_id_fkey(id, full_name, avatar_url, title)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  // Check access
  const meeting = instance.meeting;
  if (
    meeting.manager_id !== profile.id &&
    meeting.direct_id !== profile.id &&
    profile.access_level !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(instance);
}

// PATCH /api/one-on-one-instances/[id] - Update an instance
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

  // Get instance and verify access
  const { data: existingInstance } = await supabase
    .from("one_on_one_instances")
    .select(`
      *,
      meeting:one_on_one_meetings!one_on_one_instances_meeting_id_fkey(manager_id, direct_id)
    `)
    .eq("id", id)
    .single();

  if (!existingInstance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  const meeting = existingInstance.meeting;
  if (
    meeting.manager_id !== profile.id &&
    meeting.direct_id !== profile.id &&
    profile.access_level !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    scheduled_at,
    started_at,
    ended_at,
    status,
    notes,
    ai_summary,
    rocks_snapshot,
    metrics_snapshot,
  } = body;

  const updateData: Record<string, unknown> = {};
  if (scheduled_at !== undefined) updateData.scheduled_at = scheduled_at;
  if (started_at !== undefined) updateData.started_at = started_at;
  if (ended_at !== undefined) updateData.ended_at = ended_at;
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (ai_summary !== undefined) updateData.ai_summary = ai_summary;
  if (rocks_snapshot !== undefined) updateData.rocks_snapshot = rocks_snapshot;
  if (metrics_snapshot !== undefined) updateData.metrics_snapshot = metrics_snapshot;

  const { data: instance, error } = await supabase
    .from("one_on_one_instances")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating 1:1 instance:", error);
    return NextResponse.json({ error: "Failed to update instance" }, { status: 500 });
  }

  return NextResponse.json(instance);
}

// DELETE /api/one-on-one-instances/[id] - Cancel/delete an instance
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

  // Get instance and verify access
  const { data: existingInstance } = await supabase
    .from("one_on_one_instances")
    .select(`
      *,
      meeting:one_on_one_meetings!one_on_one_instances_meeting_id_fkey(manager_id, direct_id)
    `)
    .eq("id", id)
    .single();

  if (!existingInstance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  const meeting = existingInstance.meeting;
  if (
    meeting.manager_id !== profile.id &&
    meeting.direct_id !== profile.id &&
    profile.access_level !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If completed, don't allow deletion
  if (existingInstance.status === "completed") {
    return NextResponse.json(
      { error: "Cannot delete a completed meeting instance" },
      { status: 400 }
    );
  }

  // Soft delete by marking as cancelled
  const { error } = await supabase
    .from("one_on_one_instances")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) {
    console.error("Error cancelling 1:1 instance:", error);
    return NextResponse.json({ error: "Failed to cancel instance" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
