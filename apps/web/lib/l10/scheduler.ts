/**
 * Inngest Job Definitions for L10 Meeting Auto-Agenda
 *
 * These functions define the background jobs for automatically generating
 * L10 meeting agendas before scheduled meetings.
 *
 * To use these with Inngest:
 * 1. Install inngest: npm install inngest
 * 2. Set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY env vars
 * 3. Create an Inngest client and serve these functions
 *
 * For now, these can also be triggered manually via API routes.
 */

import { createAdminClient } from "@/lib/supabase/server";

interface JobResult {
  success: boolean;
  meetingsProcessed?: number;
  error?: string;
}

/**
 * Auto-generate agenda for L10 meetings scheduled in the next 2-3 hours
 * Designed to run every hour via cron
 */
export async function generateUpcomingMeetingAgendas(): Promise<JobResult> {
  console.log("Checking for upcoming L10 meetings that need agenda generation...");

  const supabase = createAdminClient();

  try {
    // Find meetings scheduled 2-3 hours from now that don't have snapshots yet
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const threeHoursFromNow = new Date(Date.now() + 3 * 60 * 60 * 1000);

    const { data: upcomingMeetings, error: meetingsError } = await supabase
      .from("l10_meetings")
      .select("*")
      .eq("status", "scheduled")
      .gte("scheduled_at", twoHoursFromNow.toISOString())
      .lt("scheduled_at", threeHoursFromNow.toISOString())
      .is("scorecard_snapshot", null);

    if (meetingsError) {
      console.error("Error fetching upcoming meetings:", meetingsError);
      return { success: false, error: meetingsError.message };
    }

    if (!upcomingMeetings || upcomingMeetings.length === 0) {
      console.log("No meetings need agenda generation at this time");
      return { success: true, meetingsProcessed: 0 };
    }

    console.log(`Found ${upcomingMeetings.length} meetings to process`);

    let processed = 0;

    for (const meeting of upcomingMeetings) {
      try {
        await generateAgendaForMeeting(meeting.id);
        processed++;
        console.log(`Generated agenda for meeting: ${meeting.title} (${meeting.id})`);
      } catch (error) {
        console.error(`Failed to generate agenda for meeting ${meeting.id}:`, error);
      }
    }

    return {
      success: true,
      meetingsProcessed: processed,
    };
  } catch (error) {
    console.error("Auto-agenda generation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate agenda and snapshots for a specific meeting
 */
async function generateAgendaForMeeting(meetingId: string): Promise<void> {
  const supabase = createAdminClient();

  // Get current state for snapshots
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
        owner:profiles!rocks_owner_id_fkey(id, full_name)
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

  // Build scorecard snapshot with current values
  const scorecardSnapshot = (scorecardResult.data || []).map((metric) => {
    const latestValue = (metricValues || []).find((v) => v.metric_id === metric.id);
    return {
      ...metric,
      current_value: latestValue?.value || null,
      recorded_at: latestValue?.recorded_at || null,
    };
  });

  // Update meeting with snapshots
  await supabase
    .from("l10_meetings")
    .update({
      scorecard_snapshot: scorecardSnapshot,
      rocks_snapshot: rocksResult.data || [],
    })
    .eq("id", meetingId);

  // Check if agenda items exist, create if not
  const { count } = await supabase
    .from("l10_agenda_items")
    .select("*", { count: "exact", head: true })
    .eq("meeting_id", meetingId);

  if (!count || count === 0) {
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
      meeting_id: meetingId,
      ...item,
    }));

    await supabase.from("l10_agenda_items").insert(agendaRecords);
  }
}

/**
 * Send meeting reminders
 * Can be called 1 hour and 15 minutes before meeting
 */
export async function sendMeetingReminders(): Promise<JobResult> {
  console.log("Checking for meetings that need reminders...");

  const supabase = createAdminClient();

  try {
    // Find meetings starting in 55-65 minutes (1 hour reminder)
    const fiftyFiveMinutesFromNow = new Date(Date.now() + 55 * 60 * 1000);
    const sixtyFiveMinutesFromNow = new Date(Date.now() + 65 * 60 * 1000);

    const { data: meetings, error } = await supabase
      .from("l10_meetings")
      .select(`
        *,
        attendees:l10_meeting_attendees(
          profile:profiles(id, email, full_name)
        )
      `)
      .eq("status", "scheduled")
      .gte("scheduled_at", fiftyFiveMinutesFromNow.toISOString())
      .lt("scheduled_at", sixtyFiveMinutesFromNow.toISOString());

    if (error) {
      console.error("Error fetching meetings for reminders:", error);
      return { success: false, error: error.message };
    }

    if (!meetings || meetings.length === 0) {
      return { success: true, meetingsProcessed: 0 };
    }

    // In a real implementation, you would send emails/notifications here
    // For now, we just log
    for (const meeting of meetings) {
      console.log(`Would send reminder for meeting: ${meeting.title}`);
      console.log(`  Attendees: ${meeting.attendees?.length || 0}`);
    }

    return {
      success: true,
      meetingsProcessed: meetings.length,
    };
  } catch (error) {
    console.error("Meeting reminder job failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Example Inngest function definitions (for reference)
 *
 * If using Inngest, create a client and register these:
 *
 * ```typescript
 * import { Inngest } from 'inngest';
 *
 * const inngest = new Inngest({ id: 'cadence' });
 *
 * export const generateL10AgendaJob = inngest.createFunction(
 *   { id: 'generate-l10-agenda', name: 'Generate L10 Meeting Agenda' },
 *   { cron: '0 * * * *' }, // Every hour
 *   async ({ step }) => {
 *     return await step.run('generate', generateUpcomingMeetingAgendas);
 *   }
 * );
 *
 * export const sendL10RemindersJob = inngest.createFunction(
 *   { id: 'send-l10-reminders', name: 'Send L10 Meeting Reminders' },
 *   { cron: '​*​/15 * * * *' }, // Every 15 minutes
 *   async ({ step }) => {
 *     return await step.run('remind', sendMeetingReminders);
 *   }
 * );
 * ```
 */
