import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/one-on-ones/[id]/instances - List instances for a 1:1 meeting
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
  const status = searchParams.get("status");
  const upcoming = searchParams.get("upcoming") === "true";
  const limit = parseInt(searchParams.get("limit") || "10");

  let query = supabase
    .from("one_on_one_instances")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("scheduled_at", { ascending: upcoming })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  if (upcoming) {
    query = query.gte("scheduled_at", new Date().toISOString());
  }

  const { data: instances, error } = await query;

  if (error) {
    console.error("Error fetching 1:1 instances:", error);
    return NextResponse.json({ error: "Failed to fetch instances" }, { status: 500 });
  }

  return NextResponse.json(instances);
}

// POST /api/one-on-ones/[id]/instances - Schedule a new instance
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
  const { scheduled_at } = body;

  if (!scheduled_at) {
    return NextResponse.json({ error: "scheduled_at is required" }, { status: 400 });
  }

  const { data: instance, error } = await supabase
    .from("one_on_one_instances")
    .insert({
      meeting_id: meetingId,
      scheduled_at,
      status: "scheduled",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating 1:1 instance:", error);
    return NextResponse.json({ error: "Failed to create instance" }, { status: 500 });
  }

  return NextResponse.json(instance, { status: 201 });
}
