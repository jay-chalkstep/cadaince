import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/one-on-ones - List user's 1:1 meetings
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role"); // 'manager' or 'direct'
  const activeOnly = searchParams.get("active") !== "false";

  let query = supabase
    .from("one_on_one_meetings")
    .select(`
      *,
      manager:profiles!one_on_one_meetings_manager_id_fkey(id, full_name, avatar_url, title, email),
      direct:profiles!one_on_one_meetings_direct_id_fkey(id, full_name, avatar_url, title, email)
    `)
    .order("created_at", { ascending: false });

  // Filter by role
  if (role === "manager") {
    query = query.eq("manager_id", profile.id);
  } else if (role === "direct") {
    query = query.eq("direct_id", profile.id);
  } else {
    // Show all 1:1s where user is a participant
    query = query.or(`manager_id.eq.${profile.id},direct_id.eq.${profile.id}`);
  }

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data: meetings, error } = await query;

  if (error) {
    console.error("Error fetching 1:1 meetings:", error);
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
  }

  return NextResponse.json(meetings);
}

// POST /api/one-on-ones - Create a new 1:1 meeting
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level, full_name")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json();
  const { manager_id, direct_id, title, meeting_day, meeting_time, duration_minutes } = body;

  // Validate required fields
  if (!manager_id || !direct_id) {
    return NextResponse.json(
      { error: "manager_id and direct_id are required" },
      { status: 400 }
    );
  }

  // Ensure user is the manager or an admin
  if (profile.id !== manager_id && profile.access_level !== "admin") {
    return NextResponse.json(
      { error: "Only managers or admins can create 1:1 meetings" },
      { status: 403 }
    );
  }

  // Check for existing meeting
  const { data: existing } = await supabase
    .from("one_on_one_meetings")
    .select("id")
    .eq("manager_id", manager_id)
    .eq("direct_id", direct_id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "A 1:1 meeting already exists between these two people" },
      { status: 400 }
    );
  }

  // Get direct's name if title not provided
  let meetingTitle = title;
  if (!meetingTitle) {
    const { data: participants } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [manager_id, direct_id]);

    const managerName = participants?.find(p => p.id === manager_id)?.full_name || "Manager";
    const directName = participants?.find(p => p.id === direct_id)?.full_name || "Direct";
    meetingTitle = `${managerName} / ${directName} 1:1`;
  }

  const { data: meeting, error } = await supabase
    .from("one_on_one_meetings")
    .insert({
      manager_id,
      direct_id,
      title: meetingTitle,
      meeting_day,
      meeting_time,
      duration_minutes: duration_minutes || 30,
      is_active: true,
    })
    .select(`
      *,
      manager:profiles!one_on_one_meetings_manager_id_fkey(id, full_name, avatar_url, title),
      direct:profiles!one_on_one_meetings_direct_id_fkey(id, full_name, avatar_url, title)
    `)
    .single();

  if (error) {
    console.error("Error creating 1:1 meeting:", error);
    return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
  }

  return NextResponse.json(meeting, { status: 201 });
}
