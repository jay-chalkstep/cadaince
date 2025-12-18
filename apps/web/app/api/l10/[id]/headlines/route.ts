import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface Headline {
  id: string;
  text: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

// POST /api/l10/[id]/headlines - Add a headline to the meeting
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

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json();
  const { text } = body;

  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  // Get current meeting
  const { data: meeting, error: meetingError } = await supabase
    .from("l10_meetings")
    .select("headlines")
    .eq("id", id)
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Add new headline
  const currentHeadlines = (meeting.headlines as Headline[]) || [];
  const newHeadline: Headline = {
    id: crypto.randomUUID(),
    text,
    author_id: profile.id,
    author_name: profile.full_name,
    created_at: new Date().toISOString(),
  };

  const updatedHeadlines = [...currentHeadlines, newHeadline];

  // Update meeting
  const { error: updateError } = await supabase
    .from("l10_meetings")
    .update({ headlines: updatedHeadlines })
    .eq("id", id);

  if (updateError) {
    console.error("Error adding headline:", updateError);
    return NextResponse.json({ error: "Failed to add headline" }, { status: 500 });
  }

  return NextResponse.json(newHeadline, { status: 201 });
}

// DELETE /api/l10/[id]/headlines - Remove a headline
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

  const { searchParams } = new URL(req.url);
  const headlineId = searchParams.get("headline_id");

  if (!headlineId) {
    return NextResponse.json({ error: "headline_id is required" }, { status: 400 });
  }

  // Get current meeting
  const { data: meeting, error: meetingError } = await supabase
    .from("l10_meetings")
    .select("headlines")
    .eq("id", id)
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Remove headline
  const currentHeadlines = (meeting.headlines as Headline[]) || [];
  const updatedHeadlines = currentHeadlines.filter((h) => h.id !== headlineId);

  // Update meeting
  const { error: updateError } = await supabase
    .from("l10_meetings")
    .update({ headlines: updatedHeadlines })
    .eq("id", id);

  if (updateError) {
    console.error("Error removing headline:", updateError);
    return NextResponse.json({ error: "Failed to remove headline" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
