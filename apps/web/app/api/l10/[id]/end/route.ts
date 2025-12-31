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
  const summary = await generateMeetingSummary(supabase, id, meeting, durationMinutes, ratings, cascadingMessages);

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
  durationMinutes: number,
  ratings: Record<string, number> | null,
  cascadingMessages: string | null
): Promise<string> {
  // Get all meeting data
  const [
    issuesResult,
    todosResult,
    headlinesResult,
    attendeesResult,
    newTodosResult,
  ] = await Promise.all([
    supabase
      .from("l10_issues_discussed")
      .select(`
        *,
        issue:issues(title, description),
        todo:todos(title, owner_id, due_date)
      `)
      .eq("meeting_id", meetingId)
      .order("discussed_at"),
    supabase
      .from("l10_todos_reviewed")
      .select(`
        *,
        todo:todos(title, owner:profiles!todos_owner_id_fkey(full_name))
      `)
      .eq("meeting_id", meetingId),
    supabase
      .from("headlines")
      .select(`
        id,
        title,
        headline_type,
        created_by_profile:profiles!headlines_created_by_fkey(full_name)
      `)
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("l10_meeting_attendees")
      .select(`
        *,
        profile:profiles(id, full_name)
      `)
      .eq("meeting_id", meetingId),
    // Get new to-dos created during this meeting
    supabase
      .from("todos")
      .select(`
        id,
        title,
        due_date,
        owner:profiles!todos_owner_id_fkey(full_name)
      `)
      .eq("meeting_id", meetingId),
  ]);

  const headlines = headlinesResult.data || [];
  const issuesDiscussed = issuesResult.data || [];
  const todosReviewed = todosResult.data || [];
  const attendees = attendeesResult.data || [];
  const newTodos = newTodosResult.data || [];
  const scorecardSnapshot = (meeting.scorecard_snapshot as Array<{
    name: string;
    current_value: number | null;
    goal: number | null;
    unit: string | null;
  }>) || [];
  const rocksSnapshot = (meeting.rocks_snapshot as Array<{
    title: string;
    status: string;
    owner?: { full_name: string };
  }>) || [];

  // Build summary markdown
  let summary = `# L10 Meeting Summary\n\n`;
  summary += `**Date:** ${new Date(meeting.scheduled_at as string).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n\n`;
  summary += `**Duration:** ${durationMinutes} minutes\n\n`;

  // Attendees & Ratings
  if (attendees.length > 0) {
    summary += `## Attendees\n\n`;
    attendees.forEach((a) => {
      const profile = Array.isArray(a.profile) ? a.profile[0] : a.profile;
      const name = profile?.full_name || "Unknown";
      const rating = ratings?.[profile?.id];
      if (rating !== undefined) {
        summary += `- ${name} — rated **${rating}/10**\n`;
      } else {
        summary += `- ${name}\n`;
      }
    });
    if (ratings) {
      const ratingValues = Object.values(ratings);
      const avg = ratingValues.length > 0
        ? (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(1)
        : null;
      if (avg) {
        summary += `\n**Team Average: ${avg}/10**\n`;
      }
    }
    summary += `\n`;
  }

  // Scorecard Review
  if (scorecardSnapshot.length > 0) {
    const onTrack = scorecardSnapshot.filter((m) => m.current_value !== null && m.goal !== null && m.current_value >= m.goal);
    const offTrack = scorecardSnapshot.filter((m) => m.current_value !== null && m.goal !== null && m.current_value < m.goal);

    summary += `## Scorecard Review\n\n`;
    summary += `- **On Track:** ${onTrack.length}\n`;
    summary += `- **Off Track:** ${offTrack.length}\n\n`;

    if (offTrack.length > 0) {
      summary += `**Metrics Needing Attention:**\n`;
      offTrack.forEach((m) => {
        summary += `- ${m.name}: ${m.current_value}${m.unit || ""} (goal: ${m.goal}${m.unit || ""})\n`;
      });
      summary += `\n`;
    }
  }

  // Rock Review
  if (rocksSnapshot.length > 0) {
    const onTrack = rocksSnapshot.filter((r) => r.status === "on_track");
    const offTrack = rocksSnapshot.filter((r) => r.status === "off_track");
    const atRisk = rocksSnapshot.filter((r) => r.status === "at_risk");
    const done = rocksSnapshot.filter((r) => r.status === "complete" || r.status === "done");

    summary += `## Rock Review\n\n`;
    summary += `- **On Track:** ${onTrack.length}\n`;
    summary += `- **Off Track:** ${offTrack.length}\n`;
    summary += `- **At Risk:** ${atRisk.length}\n`;
    summary += `- **Complete:** ${done.length}\n\n`;

    if (offTrack.length > 0 || atRisk.length > 0) {
      summary += `**Rocks Needing Attention:**\n`;
      [...offTrack, ...atRisk].forEach((r) => {
        const owner = r.owner?.full_name || "Unassigned";
        summary += `- ${r.title} (${r.status.replace("_", " ")}) — ${owner}\n`;
      });
      summary += `\n`;
    }
  }

  // Headlines
  if (headlines.length > 0) {
    summary += `## Headlines\n\n`;
    headlines.forEach((h) => {
      const profile = Array.isArray(h.created_by_profile)
        ? h.created_by_profile[0]
        : h.created_by_profile;
      const author = profile?.full_name || "Unknown";
      const typeEmoji = h.headline_type === "customer" ? "🎉" : h.headline_type === "employee" ? "⭐" : "📢";
      summary += `- ${typeEmoji} ${h.title} — *${author}*\n`;
    });
    summary += `\n`;
  }

  // To-Dos Reviewed
  if (todosReviewed.length > 0) {
    const completed = todosReviewed.filter((t) => t.status_at_review === "done");
    const notDone = todosReviewed.filter((t) => t.status_at_review === "not_done");
    const pushed = todosReviewed.filter((t) => t.status_at_review === "pushed");

    summary += `## To-Do Review\n\n`;
    summary += `- **Done:** ${completed.length}\n`;
    summary += `- **Not Done:** ${notDone.length}\n`;
    summary += `- **Pushed:** ${pushed.length}\n\n`;

    if (notDone.length > 0) {
      summary += `**Incomplete To-Dos:**\n`;
      notDone.forEach((t) => {
        const todo = Array.isArray(t.todo) ? t.todo[0] : t.todo;
        const owner = Array.isArray(todo?.owner) ? todo?.owner[0] : todo?.owner;
        summary += `- ${todo?.title || "Unknown"} — ${owner?.full_name || "Unassigned"}\n`;
      });
      summary += `\n`;
    }
  }

  // IDS - Issues Discussed
  if (issuesDiscussed.length > 0) {
    summary += `## IDS - Issues Discussed\n\n`;

    const solved = issuesDiscussed.filter((i) => i.outcome === "solved");
    const todoCreated = issuesDiscussed.filter((i) => i.outcome === "todo_created");
    const pushedIssues = issuesDiscussed.filter((i) => i.outcome === "pushed");
    const killed = issuesDiscussed.filter((i) => i.outcome === "killed");

    summary += `- **Solved:** ${solved.length}\n`;
    summary += `- **To-Do Created:** ${todoCreated.length}\n`;
    summary += `- **Pushed to Next Week:** ${pushedIssues.length}\n`;
    summary += `- **Killed:** ${killed.length}\n\n`;

    issuesDiscussed.forEach((i) => {
      const issue = Array.isArray(i.issue) ? i.issue[0] : i.issue;
      const outcomeLabel = i.outcome === "todo_created" ? "→ To-Do"
        : i.outcome === "solved" ? "✓ Solved"
        : i.outcome === "killed" ? "✗ Killed"
        : "↻ Pushed";

      summary += `### ${issue?.title || "Unknown Issue"}\n\n`;
      summary += `**Outcome:** ${outcomeLabel}\n\n`;

      if (i.decision_notes) {
        summary += `**Decision:** ${i.decision_notes}\n\n`;
      }

      // If a to-do was created, show details
      if (i.outcome === "todo_created" && i.todo) {
        const todo = Array.isArray(i.todo) ? i.todo[0] : i.todo;
        if (todo) {
          summary += `**Action Item:** ${todo.title}\n`;
          if (todo.due_date) {
            summary += `**Due:** ${new Date(todo.due_date).toLocaleDateString()}\n`;
          }
          summary += `\n`;
        }
      }
    });
  }

  // New To-Dos Created
  if (newTodos.length > 0) {
    summary += `## New To-Dos Created\n\n`;
    newTodos.forEach((t) => {
      const owner = Array.isArray(t.owner) ? t.owner[0] : t.owner;
      const dueDate = t.due_date ? new Date(t.due_date).toLocaleDateString() : "No due date";
      summary += `- ${t.title} — ${owner?.full_name || "Unassigned"} (due: ${dueDate})\n`;
    });
    summary += `\n`;
  }

  // Cascading Messages
  if (cascadingMessages) {
    summary += `## Cascading Messages\n\n`;
    summary += `${cascadingMessages}\n\n`;
  }

  return summary;
}
