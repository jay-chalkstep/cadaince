import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/l10/[id]/end - End a L10 meeting
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

  // Get meeting
  const { data: meeting, error: meetingError } = await supabase
    .from("l10_meetings")
    .select("*")
    .eq("id", id)
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (meeting.status !== "in_progress") {
    return NextResponse.json(
      { error: `Cannot end meeting with status: ${meeting.status}` },
      { status: 400 }
    );
  }

  // Parse request body for ratings and cascading messages
  let rating: number | null = null;
  let ratings: Record<string, number> | null = null;
  let cascadingMessages: string | null = null;
  try {
    const body = await req.json();
    rating = body.rating; // Average rating
    ratings = body.ratings; // Per-attendee ratings { profileId: rating }
    cascadingMessages = body.cascading_messages;
  } catch {
    // No body provided
  }

  // Calculate duration
  const startedAt = new Date(meeting.started_at);
  const endedAt = new Date();
  const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

  // Complete any incomplete agenda items
  await supabase
    .from("l10_agenda_items")
    .update({ completed_at: endedAt.toISOString() })
    .eq("meeting_id", id)
    .is("completed_at", null);

  // Generate meeting summary
  const summary = await generateMeetingSummary(supabase, id, meeting, durationMinutes);

  // Update meeting
  const { data: updatedMeeting, error: updateError } = await supabase
    .from("l10_meetings")
    .update({
      status: "completed",
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
      rating, // Average rating
      ratings, // Per-attendee ratings as JSONB
      cascading_messages: cascadingMessages,
      notes: summary,
    })
    .eq("id", id)
    .select(`
      *,
      created_by_profile:profiles!l10_meetings_created_by_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (updateError) {
    console.error("Error ending meeting:", updateError);
    return NextResponse.json({ error: "Failed to end meeting" }, { status: 500 });
  }

  return NextResponse.json(updatedMeeting);
}

async function generateMeetingSummary(
  supabase: ReturnType<typeof createAdminClient>,
  meetingId: string,
  meeting: Record<string, unknown>,
  durationMinutes: number
): Promise<string> {
  // Get meeting data including headlines from the headlines table
  const [issuesResult, todosResult, agendaResult, headlinesResult] = await Promise.all([
    supabase
      .from("l10_issues_discussed")
      .select(`
        *,
        issue:issues(title),
        todo:todos(title, owner_id)
      `)
      .eq("meeting_id", meetingId),
    supabase
      .from("l10_todos_reviewed")
      .select(`
        *,
        todo:todos(title, completed_at)
      `)
      .eq("meeting_id", meetingId),
    supabase
      .from("l10_agenda_items")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("sort_order"),
    supabase
      .from("headlines")
      .select(`
        id,
        title,
        created_by_profile:profiles!headlines_created_by_fkey(full_name)
      `)
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const headlines = headlinesResult.data || [];
  const issuesDiscussed = issuesResult.data || [];
  const todosReviewed = todosResult.data || [];

  // Build summary markdown
  let summary = `# L10 Meeting Summary\n\n`;
  summary += `**Date:** ${new Date(meeting.scheduled_at as string).toLocaleDateString()}\n`;
  summary += `**Duration:** ${durationMinutes} minutes\n\n`;

  // Headlines
  if (headlines.length > 0) {
    summary += `## Headlines\n`;
    headlines.forEach((h: { title: string; created_by_profile: { full_name: string } | null }) => {
      const author = h.created_by_profile?.full_name || "Unknown";
      summary += `- ${h.title} — ${author}\n`;
    });
    summary += `\n`;
  }

  // Issues
  if (issuesDiscussed.length > 0) {
    summary += `## Issues Discussed (${issuesDiscussed.length})\n`;
    issuesDiscussed.forEach((id) => {
      const outcome = id.outcome || "discussed";
      const issueTitle = (id.issue as { title?: string })?.title || "Unknown issue";
      summary += `- **${issueTitle}** - ${outcome}\n`;
      if (id.decision_notes) {
        summary += `  - ${id.decision_notes}\n`;
      }
    });
    summary += `\n`;
  }

  // To-Dos Reviewed
  const completedTodos = todosReviewed.filter((t) => t.status_at_review === "done");
  const incompleteTodos = todosReviewed.filter((t) => t.status_at_review !== "done");

  if (todosReviewed.length > 0) {
    summary += `## To-Dos Reviewed\n`;
    summary += `- Completed: ${completedTodos.length}\n`;
    summary += `- Incomplete: ${incompleteTodos.length}\n\n`;
  }

  return summary;
}
