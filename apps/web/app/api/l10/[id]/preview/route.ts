import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/l10/[id]/preview - Get meeting preview data for preparation
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

  // Get user's profile and organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Get the meeting
  const { data: meeting, error: meetingError } = await supabase
    .from("l10_meetings")
    .select(`
      id,
      title,
      meeting_type,
      scheduled_at,
      status,
      organization_id,
      created_by_profile:profiles!l10_meetings_created_by_fkey(id, full_name, avatar_url)
    `)
    .eq("id", id)
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Verify meeting belongs to user's org (or has no org for legacy meetings)
  if (meeting.organization_id && meeting.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Get attendees
  const { data: attendees } = await supabase
    .from("l10_meeting_attendees")
    .select(`
      id,
      profile:profiles(id, full_name, avatar_url, role)
    `)
    .eq("meeting_id", id);

  // Fetch preview data in parallel
  const [
    queuedIssuesResult,
    offTrackRocksResult,
    belowGoalMetricsResult,
    carryoverTodosResult,
  ] = await Promise.all([
    // Queued issues for this meeting
    supabase
      .from("issues")
      .select(`
        id,
        title,
        description,
        priority,
        queue_order,
        created_at,
        raised_by_profile:profiles!issues_raised_by_fkey(id, full_name, avatar_url)
      `)
      .eq("queued_for_meeting_id", id)
      .order("queue_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),

    // Off-track and at-risk rocks for the organization
    supabase
      .from("rocks")
      .select(`
        id,
        title,
        status,
        due_date,
        owner:profiles!owner_id(id, full_name, avatar_url)
      `)
      .eq("organization_id", profile.organization_id)
      .in("status", ["off_track", "at_risk"])
      .order("status", { ascending: true }) // off_track before at_risk
      .order("due_date", { ascending: true }),

    // Below-goal metrics - need to get latest values and compare
    getBelowGoalMetrics(supabase, profile.organization_id),

    // Carryover todos - incomplete and past due
    supabase
      .from("todos")
      .select(`
        id,
        title,
        due_date,
        owner:profiles!todos_owner_id_fkey(id, full_name, avatar_url)
      `)
      .eq("organization_id", profile.organization_id)
      .eq("is_complete", false)
      .lt("due_date", meeting.scheduled_at.split("T")[0])
      .order("due_date", { ascending: true }),
  ]);

  return NextResponse.json({
    meeting: {
      ...meeting,
      attendees: attendees || [],
    },
    queuedIssues: queuedIssuesResult.data || [],
    offTrackRocks: offTrackRocksResult.data || [],
    belowGoalMetrics: belowGoalMetricsResult,
    carryoverTodos: carryoverTodosResult.data || [],
  });
}

// Helper function to get metrics below goal with their latest values
async function getBelowGoalMetrics(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string
) {
  // Get active metrics with goals
  const { data: metrics } = await supabase
    .from("metrics")
    .select(`
      id,
      name,
      goal,
      unit,
      threshold_red,
      threshold_yellow,
      owner:profiles!metrics_owner_id_fkey(id, full_name, avatar_url)
    `)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .not("goal", "is", null);

  if (!metrics || metrics.length === 0) {
    return [];
  }

  // Get latest values for each metric
  const metricIds = metrics.map((m) => m.id);
  const { data: latestValues } = await supabase
    .from("metric_values")
    .select("metric_id, value, recorded_at")
    .in("metric_id", metricIds)
    .order("recorded_at", { ascending: false });

  // Create a map of metric_id to latest value
  const latestValueMap = new Map<string, { value: number; recorded_at: string }>();
  for (const v of latestValues || []) {
    if (!latestValueMap.has(v.metric_id)) {
      latestValueMap.set(v.metric_id, { value: v.value, recorded_at: v.recorded_at });
    }
  }

  // Filter to metrics where current value is below goal
  const belowGoal = metrics
    .map((metric) => {
      const latest = latestValueMap.get(metric.id);
      return {
        ...metric,
        current_value: latest?.value ?? null,
        recorded_at: latest?.recorded_at ?? null,
      };
    })
    .filter((metric) => {
      if (metric.current_value === null || metric.goal === null) return false;
      return metric.current_value < metric.goal;
    });

  return belowGoal;
}
