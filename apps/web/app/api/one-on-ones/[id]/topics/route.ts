import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/one-on-ones/[id]/topics - List topics for a 1:1 meeting
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: meetingId } = await params;
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

  // Verify user has access to this meeting
  const { data: meeting } = await supabase
    .from("one_on_one_meetings")
    .select("manager_id, direct_id")
    .eq("id", meetingId)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (
    meeting.manager_id !== profile.id &&
    meeting.direct_id !== profile.id &&
    profile.access_level !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // 'open', 'discussed', 'resolved'

  let query = supabase
    .from("one_on_one_topics")
    .select(`
      *,
      added_by:profiles!one_on_one_topics_added_by_id_fkey(id, full_name, avatar_url)
    `)
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: topics, error } = await query;

  if (error) {
    console.error("Error fetching 1:1 topics:", error);
    return NextResponse.json({ error: "Failed to fetch topics" }, { status: 500 });
  }

  return NextResponse.json(topics);
}

// POST /api/one-on-ones/[id]/topics - Add a topic to a 1:1 meeting
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: meetingId } = await params;
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

  // Verify user has access to this meeting
  const { data: meeting } = await supabase
    .from("one_on_one_meetings")
    .select("manager_id, direct_id")
    .eq("id", meetingId)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (
    meeting.manager_id !== profile.id &&
    meeting.direct_id !== profile.id &&
    profile.access_level !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, notes } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const { data: topic, error } = await supabase
    .from("one_on_one_topics")
    .insert({
      meeting_id: meetingId,
      added_by_id: profile.id,
      title,
      notes,
      status: "open",
    })
    .select(`
      *,
      added_by:profiles!one_on_one_topics_added_by_id_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error creating 1:1 topic:", error);
    return NextResponse.json({ error: "Failed to create topic" }, { status: 500 });
  }

  return NextResponse.json(topic, { status: 201 });
}
