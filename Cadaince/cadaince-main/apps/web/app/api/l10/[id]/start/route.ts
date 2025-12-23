import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/l10/[id]/start - Start a L10 meeting
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

  if (meeting.status !== "scheduled") {
    return NextResponse.json(
      { error: `Cannot start meeting with status: ${meeting.status}` },
      { status: 400 }
    );
  }

  // Capture snapshots
  const [scorecardResult, rocksResult] = await Promise.all([
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
  ]);

  // Get current values for metrics
  const metricIds = (scorecardResult.data || []).map((m) => m.id);
  const { data: metricValues } = await supabase
    .from("metric_values")
    .select("metric_id, value, recorded_at")
    .in("metric_id", metricIds)
    .order("recorded_at", { ascending: false });

  // Attach latest values to metrics
  const scorecardSnapshot = (scorecardResult.data || []).map((metric) => {
    const latestValue = (metricValues || []).find((v) => v.metric_id === metric.id);
    return {
      ...metric,
      current_value: latestValue?.value || null,
      recorded_at: latestValue?.recorded_at || null,
    };
  });

  // Update meeting to in_progress
  const { data: updatedMeeting, error: updateError } = await supabase
    .from("l10_meetings")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
      scorecard_snapshot: scorecardSnapshot,
      rocks_snapshot: rocksResult.data || [],
    })
    .eq("id", id)
    .select(`
      *,
      created_by_profile:profiles!l10_meetings_created_by_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (updateError) {
    console.error("Error starting meeting:", updateError);
    return NextResponse.json({ error: "Failed to start meeting" }, { status: 500 });
  }

  // Start the first agenda item
  const { data: firstAgendaItem } = await supabase
    .from("l10_agenda_items")
    .select("id")
    .eq("meeting_id", id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .single();

  if (firstAgendaItem) {
    await supabase
      .from("l10_agenda_items")
      .update({ started_at: new Date().toISOString() })
      .eq("id", firstAgendaItem.id);
  }

  return NextResponse.json(updatedMeeting);
}
