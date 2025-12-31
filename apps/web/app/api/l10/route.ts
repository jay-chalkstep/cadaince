import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/l10 - List all L10 meetings
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "20");
  const upcoming = searchParams.get("upcoming") === "true";

  const supabase = createAdminClient();

  let query = supabase
    .from("l10_meetings")
    .select(`
      *,
      created_by_profile:profiles!l10_meetings_created_by_fkey(id, full_name, avatar_url)
    `)
    .order("scheduled_at", { ascending: upcoming });

  if (status) {
    query = query.eq("status", status);
  }

  if (upcoming) {
    // Show meetings that are scheduled or in_progress (exclude completed/cancelled)
    // Also include past in_progress meetings that haven't been ended yet
    query = query.in("status", ["scheduled", "in_progress"]);
  }

  query = query.limit(limit);

  const { data: meetings, error } = await query;

  if (error) {
    console.error("Error fetching L10 meetings:", error);
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
  }

  return NextResponse.json(meetings);
}

// POST /api/l10 - Create a new L10 meeting
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level, is_elt")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Only admin and ELT can create L10 meetings
  if (profile.access_level !== "admin" && profile.access_level !== "elt" && !profile.is_elt) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, meeting_type, scheduled_at, attendee_ids } = body;

  if (!title || !scheduled_at) {
    return NextResponse.json(
      { error: "Title and scheduled_at are required" },
      { status: 400 }
    );
  }

  // Create the meeting
  const { data: meeting, error } = await supabase
    .from("l10_meetings")
    .insert({
      title,
      meeting_type: meeting_type || "leadership",
      scheduled_at,
      created_by: profile.id,
      organization_id: profile.organization_id,
    })
    .select(`
      *,
      created_by_profile:profiles!l10_meetings_created_by_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error creating L10 meeting:", error);
    return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
  }

  // Add attendees if provided
  if (attendee_ids && attendee_ids.length > 0) {
    const attendeeRecords = attendee_ids.map((profileId: string) => ({
      meeting_id: meeting.id,
      profile_id: profileId,
    }));

    await supabase.from("l10_meeting_attendees").insert(attendeeRecords);
  }

  // Create default agenda items
  const defaultAgenda = [
    { section: "segue", duration_minutes: 5, sort_order: 1 },
    { section: "scorecard", duration_minutes: 5, sort_order: 2 },
    { section: "rocks", duration_minutes: 5, sort_order: 3 },
    { section: "headlines", duration_minutes: 5, sort_order: 4 },
    { section: "todos", duration_minutes: 5, sort_order: 5 },
    { section: "ids", duration_minutes: 60, sort_order: 6 },
    { section: "conclude", duration_minutes: 5, sort_order: 7 },
  ];

  const agendaRecords = defaultAgenda.map((item) => ({
    meeting_id: meeting.id,
    ...item,
  }));

  await supabase.from("l10_agenda_items").insert(agendaRecords);

  return NextResponse.json(meeting, { status: 201 });
}
