import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { emitIntegrationEvent } from "@/lib/inngest/emit";

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
  const governanceBodyId = searchParams.get("governance_body_id");
  const pillarId = searchParams.get("pillar_id");

  const supabase = createAdminClient();

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json([]);
  }

  let query = supabase
    .from("l10_meetings")
    .select(`
      *,
      created_by_profile:profiles!l10_meetings_created_by_fkey(id, full_name, avatar_url),
      governance_body:governance_bodies!l10_meetings_governance_body_id_fkey(id, name, body_type),
      pillar:pillars!l10_meetings_pillar_id_fkey(id, name, color)
    `)
    .eq("organization_id", profile.organization_id)
    .order("scheduled_at", { ascending: upcoming });

  if (status) {
    query = query.eq("status", status);
  }

  if (upcoming) {
    // Show meetings that are scheduled or in_progress (exclude completed/cancelled)
    // Also include past in_progress meetings that haven't been ended yet
    query = query.in("status", ["scheduled", "in_progress"]);
  }

  // Filter by governance body (for leadership L10s)
  if (governanceBodyId) {
    query = query.eq("governance_body_id", governanceBodyId);
  }

  // Filter by pillar (for pillar L10s)
  if (pillarId) {
    query = query.eq("pillar_id", pillarId);
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
  const { title, meeting_type, scheduled_at, attendee_ids, governance_body_id, pillar_id } = body;

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
      governance_body_id: governance_body_id || null,
      pillar_id: pillar_id || null,
    })
    .select(`
      *,
      created_by_profile:profiles!l10_meetings_created_by_fkey(id, full_name, avatar_url),
      governance_body:governance_bodies!l10_meetings_governance_body_id_fkey(id, name, body_type),
      pillar:pillars!l10_meetings_pillar_id_fkey(id, name, color)
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

  // Emit integration event for calendar sync, notifications, etc.
  await emitIntegrationEvent("l10/meeting.created", {
    organization_id: profile.organization_id,
    meeting_id: meeting.id,
    title: meeting.title,
    meeting_type: meeting.meeting_type,
    scheduled_at: meeting.scheduled_at,
    created_by: profile.id,
    attendee_ids: attendee_ids || [],
  });

  return NextResponse.json(meeting, { status: 201 });
}
