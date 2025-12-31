import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { emitIntegrationEvent } from "@/lib/inngest/emit";

// GET /api/l10/[id] - Get a single L10 meeting with details
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

  // Get meeting with all related data
  const { data: meeting, error } = await supabase
    .from("l10_meetings")
    .select(`
      *,
      created_by_profile:profiles!l10_meetings_created_by_fkey(id, full_name, avatar_url)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching L10 meeting:", error);
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Get agenda items
  const { data: agendaItems } = await supabase
    .from("l10_agenda_items")
    .select("*")
    .eq("meeting_id", id)
    .order("sort_order", { ascending: true });

  // Get attendees
  const { data: attendees } = await supabase
    .from("l10_meeting_attendees")
    .select(`
      *,
      profile:profiles(id, full_name, avatar_url, role)
    `)
    .eq("meeting_id", id);

  // Get issues discussed
  const { data: issuesDiscussed } = await supabase
    .from("l10_issues_discussed")
    .select(`
      *,
      issue:issues(id, title, description, status),
      todo:todos(id, title, owner_id, due_date)
    `)
    .eq("meeting_id", id);

  // Get todos reviewed
  const { data: todosReviewed } = await supabase
    .from("l10_todos_reviewed")
    .select(`
      *,
      todo:todos(id, title, owner_id, due_date, completed_at)
    `)
    .eq("meeting_id", id);

  return NextResponse.json({
    ...meeting,
    agenda_items: agendaItems || [],
    attendees: attendees || [],
    issues_discussed: issuesDiscussed || [],
    todos_reviewed: todosReviewed || [],
  });
}

// PUT /api/l10/[id] - Update a L10 meeting
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

  // Check if user is admin or creator
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: meeting } = await supabase
    .from("l10_meetings")
    .select("created_by")
    .eq("id", id)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (profile.access_level !== "admin" && meeting.created_by !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    title,
    meeting_type,
    scheduled_at,
    status,
    rating,
    notes,
    headlines,
    cascading_messages,
  } = body;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (meeting_type !== undefined) updates.meeting_type = meeting_type;
  if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at;
  if (status !== undefined) updates.status = status;
  if (rating !== undefined) updates.rating = rating;
  if (notes !== undefined) updates.notes = notes;
  if (headlines !== undefined) updates.headlines = headlines;
  if (cascading_messages !== undefined) updates.cascading_messages = cascading_messages;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: updatedMeeting, error } = await supabase
    .from("l10_meetings")
    .update(updates)
    .eq("id", id)
    .select(`
      *,
      created_by_profile:profiles!l10_meetings_created_by_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error updating L10 meeting:", error);
    return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 });
  }

  // Emit integration event for calendar updates, notifications, etc.
  if (profile.organization_id) {
    await emitIntegrationEvent("l10/meeting.updated", {
      organization_id: profile.organization_id,
      meeting_id: id,
      updated_fields: Object.keys(updates),
      title: updatedMeeting.title,
      scheduled_at: updatedMeeting.scheduled_at,
      status: updatedMeeting.status,
    });
  }

  return NextResponse.json(updatedMeeting);
}

// DELETE /api/l10/[id] - Delete a L10 meeting
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
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const { error } = await supabase
    .from("l10_meetings")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting L10 meeting:", error);
    return NextResponse.json({ error: "Failed to delete meeting" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
