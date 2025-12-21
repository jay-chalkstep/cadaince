import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/one-on-ones/[id] - Get a single 1:1 meeting with details
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

  // Get meeting with related data
  const { data: meeting, error } = await supabase
    .from("one_on_one_meetings")
    .select(`
      *,
      manager:profiles!one_on_one_meetings_manager_id_fkey(id, full_name, avatar_url, title, email),
      direct:profiles!one_on_one_meetings_direct_id_fkey(id, full_name, avatar_url, title, email)
    `)
    .eq("id", id)
    .single();

  if (error || !meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Check access: participant or admin
  if (
    meeting.manager_id !== profile.id &&
    meeting.direct_id !== profile.id &&
    profile.access_level !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get open topics
  const { data: topics } = await supabase
    .from("one_on_one_topics")
    .select(`
      *,
      added_by:profiles!one_on_one_topics_added_by_id_fkey(id, full_name, avatar_url)
    `)
    .eq("meeting_id", id)
    .eq("status", "open")
    .order("created_at", { ascending: true });

  // Get upcoming instances
  const { data: upcomingInstances } = await supabase
    .from("one_on_one_instances")
    .select("*")
    .eq("meeting_id", id)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(3);

  // Get recent completed instances
  const { data: recentInstances } = await supabase
    .from("one_on_one_instances")
    .select("*")
    .eq("meeting_id", id)
    .eq("status", "completed")
    .order("scheduled_at", { ascending: false })
    .limit(5);

  // Get direct's rocks
  const { data: directRocks } = await supabase
    .from("rocks")
    .select("*")
    .eq("owner_id", meeting.direct_id)
    .neq("status", "complete")
    .order("status", { ascending: true });

  return NextResponse.json({
    ...meeting,
    open_topics: topics || [],
    upcoming_instances: upcomingInstances || [],
    recent_instances: recentInstances || [],
    direct_rocks: directRocks || [],
  });
}

// PATCH /api/one-on-ones/[id] - Update a 1:1 meeting
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

  // Get meeting to check access
  const { data: existingMeeting } = await supabase
    .from("one_on_one_meetings")
    .select("manager_id, direct_id")
    .eq("id", id)
    .single();

  if (!existingMeeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Check access: participant or admin
  if (
    existingMeeting.manager_id !== profile.id &&
    existingMeeting.direct_id !== profile.id &&
    profile.access_level !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, meeting_day, meeting_time, duration_minutes, is_active, settings } = body;

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (meeting_day !== undefined) updateData.meeting_day = meeting_day;
  if (meeting_time !== undefined) updateData.meeting_time = meeting_time;
  if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes;
  if (is_active !== undefined) updateData.is_active = is_active;
  if (settings !== undefined) updateData.settings = settings;

  const { data: meeting, error } = await supabase
    .from("one_on_one_meetings")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      manager:profiles!one_on_one_meetings_manager_id_fkey(id, full_name, avatar_url, title),
      direct:profiles!one_on_one_meetings_direct_id_fkey(id, full_name, avatar_url, title)
    `)
    .single();

  if (error) {
    console.error("Error updating 1:1 meeting:", error);
    return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 });
  }

  return NextResponse.json(meeting);
}

// DELETE /api/one-on-ones/[id] - Deactivate a 1:1 meeting (soft delete)
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

  // Only admins can delete
  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  // Soft delete by setting is_active to false
  const { error } = await supabase
    .from("one_on_one_meetings")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("Error deactivating 1:1 meeting:", error);
    return NextResponse.json({ error: "Failed to deactivate meeting" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
