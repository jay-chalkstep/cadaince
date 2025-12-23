import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/l10/generate-agenda - Generate/refresh agenda for a meeting
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const body = await req.json();
  const { meeting_id } = body;

  if (!meeting_id) {
    return NextResponse.json({ error: "meeting_id is required" }, { status: 400 });
  }

  // Get the meeting
  const { data: meeting, error: meetingError } = await supabase
    .from("l10_meetings")
    .select("*")
    .eq("id", meeting_id)
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (meeting.status !== "scheduled") {
    return NextResponse.json(
      { error: "Can only generate agenda for scheduled meetings" },
      { status: 400 }
    );
  }

  // Get current data for potential AI ranking
  const [metricsResult, rocksResult, todosResult, issuesResult] = await Promise.all([
    supabase
      .from("metrics")
      .select(`
        id,
        name,
        goal,
        unit,
        owner:profiles!metrics_owner_id_fkey(id, full_name)
      `)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("rocks")
      .select(`
        id,
        title,
        status,
        due_date,
        owner:profiles!owner_id(id, full_name)
      `)
      .in("status", ["on_track", "at_risk", "off_track"]),
    supabase
      .from("todos")
      .select(`
        id,
        title,
        due_date,
        completed_at,
        owner:profiles!todos_owner_id_fkey(id, full_name)
      `)
      .is("completed_at", null)
      .lte("due_date", getEndOfWeek()),
    supabase
      .from("issues")
      .select(`
        id,
        title,
        description,
        priority,
        status,
        raised_by:profiles!issues_raised_by_fkey(id, full_name),
        created_at
      `)
      .in("status", ["detected", "prioritized"]),
  ]);

  // Get current values for metrics
  const metricIds = (metricsResult.data || []).map((m) => m.id);
  const { data: metricValues } = await supabase
    .from("metric_values")
    .select("metric_id, value, recorded_at")
    .in("metric_id", metricIds)
    .order("recorded_at", { ascending: false });

  // Build scorecard snapshot
  const scorecardSnapshot = (metricsResult.data || []).map((metric) => {
    const latestValue = (metricValues || []).find((v) => v.metric_id === metric.id);
    return {
      ...metric,
      current_value: latestValue?.value || null,
      recorded_at: latestValue?.recorded_at || null,
    };
  });

  // Rank issues by priority and age
  const rankedIssues = rankIssuesForIDS(issuesResult.data || []);

  // Update meeting with pre-generated data
  await supabase
    .from("l10_meetings")
    .update({
      scorecard_snapshot: scorecardSnapshot,
      rocks_snapshot: rocksResult.data || [],
    })
    .eq("id", meeting_id);

  // Get existing agenda items count
  const { count: existingCount } = await supabase
    .from("l10_agenda_items")
    .select("*", { count: "exact", head: true })
    .eq("meeting_id", meeting_id);

  // If no agenda items exist, create them
  if (!existingCount || existingCount === 0) {
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
      meeting_id,
      ...item,
    }));

    await supabase.from("l10_agenda_items").insert(agendaRecords);
  }

  // Return summary of what was generated
  return NextResponse.json({
    success: true,
    summary: {
      metrics_count: scorecardSnapshot.length,
      rocks_count: (rocksResult.data || []).length,
      todos_due_count: (todosResult.data || []).length,
      issues_count: rankedIssues.length,
      top_issues: rankedIssues.slice(0, 5).map((i) => ({
        id: i.id,
        title: i.title,
        priority: i.priority,
      })),
    },
  });
}

function getEndOfWeek(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 0;
  const friday = new Date(now);
  friday.setDate(friday.getDate() + daysUntilFriday);
  return friday.toISOString().split("T")[0];
}

interface Issue {
  id: string;
  title: string;
  priority: number | null;
  created_at: string;
  status: string;
}

function rankIssuesForIDS(issues: Issue[]): Issue[] {
  // Score issues based on:
  // 1. Explicit priority (higher = more important)
  // 2. Age (older issues get slight boost to prevent stagnation)
  return issues
    .map((issue) => {
      const priorityScore = (issue.priority || 5) * 10;
      const ageInDays = Math.floor(
        (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const ageScore = Math.min(ageInDays, 14); // Cap at 2 weeks

      return {
        ...issue,
        _score: priorityScore + ageScore,
      };
    })
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...issue }) => issue);
}
