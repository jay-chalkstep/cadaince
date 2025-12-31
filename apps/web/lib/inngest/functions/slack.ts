import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/server";
import { SlackClient } from "@/lib/integrations/slack/client";
import {
  issueQueuedTemplate,
  rockOffTrackTemplate,
  meetingReminderTemplate,
  meetingSummaryTemplate,
  issueCreatedTemplate,
} from "@/lib/integrations/slack/templates";

/**
 * Send meeting reminder 1 hour before L10 meetings
 */
export const slackMeetingReminder = inngest.createFunction(
  {
    id: "slack-meeting-reminder",
    retries: 3,
  },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    const supabase = createAdminClient();

    // Find meetings starting in 55-65 minutes
    const now = new Date();
    const min55 = new Date(now.getTime() + 55 * 60 * 1000);
    const min65 = new Date(now.getTime() + 65 * 60 * 1000);

    const meetings = await step.run("find-upcoming-meetings", async () => {
      const { data } = await supabase
        .from("l10_meetings")
        .select(`
          id,
          title,
          scheduled_at,
          organization_id,
          attendees:l10_meeting_attendees(count)
        `)
        .eq("status", "scheduled")
        .gte("scheduled_at", min55.toISOString())
        .lte("scheduled_at", min65.toISOString());

      return data || [];
    });

    // Send reminders for each meeting
    for (const meeting of meetings) {
      await step.run(`send-reminder-${meeting.id}`, async () => {
        const client = await SlackClient.fromOrganization(meeting.organization_id);
        if (!client) return;

        // Get notification settings
        const { data: settings } = await supabase
          .from("slack_notification_settings")
          .select("channel_id")
          .eq("organization_id", meeting.organization_id)
          .eq("event_type", "l10/meeting.starting_soon")
          .eq("is_enabled", true)
          .single();

        if (!settings?.channel_id) return;

        // Get issue count
        const { count: issueCount } = await supabase
          .from("issues")
          .select("id", { count: "exact", head: true })
          .eq("queued_for_meeting_id", meeting.id);

        const startsAt = new Date(meeting.scheduled_at);
        const message = meetingReminderTemplate({
          meetingTitle: meeting.title || "L10 Meeting",
          meetingId: meeting.id,
          startsAt: startsAt.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }),
          attendeeCount: (meeting.attendees as { count: number }[])?.[0]?.count || 0,
          issueCount: issueCount || 0,
        });

        await client.sendMessage(settings.channel_id, message);
      });
    }

    return { reminders_sent: meetings.length };
  }
);

/**
 * Notify when issue is queued for meeting
 */
export const slackIssueQueued = inngest.createFunction(
  {
    id: "slack-issue-queued",
    retries: 3,
    idempotency: "event.data.issue_id",
  },
  { event: "issue/queued" },
  async ({ event, step }) => {
    const { organization_id, issue_id, meeting_id, title, queued_by } = event.data as {
      organization_id: string;
      issue_id: string;
      meeting_id: string;
      title: string;
      queued_by: string;
    };

    const supabase = createAdminClient();

    // Check if Slack notifications are enabled
    const settings = await step.run("get-settings", async () => {
      const { data } = await supabase
        .from("slack_notification_settings")
        .select("channel_id")
        .eq("organization_id", organization_id)
        .eq("event_type", "issue/queued")
        .eq("is_enabled", true)
        .single();

      return data;
    });

    if (!settings?.channel_id) {
      return { skipped: true, reason: "notifications_disabled" };
    }

    const client = await SlackClient.fromOrganization(organization_id);
    if (!client) {
      return { skipped: true, reason: "slack_not_connected" };
    }

    // Get additional data
    const { queuedByName, meetingTitle, meetingDate, issueCount } = await step.run(
      "get-context",
      async () => {
        const [profileResult, meetingResult, countResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name")
            .eq("id", queued_by)
            .single(),
          supabase
            .from("l10_meetings")
            .select("title, scheduled_at")
            .eq("id", meeting_id)
            .single(),
          supabase
            .from("issues")
            .select("id", { count: "exact", head: true })
            .eq("queued_for_meeting_id", meeting_id),
        ]);

        return {
          queuedByName: profileResult.data?.full_name || "Someone",
          meetingTitle: meetingResult.data?.title || "L10 Meeting",
          meetingDate: meetingResult.data?.scheduled_at
            ? new Date(meetingResult.data.scheduled_at).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
            : "upcoming meeting",
          issueCount: countResult.count || 1,
        };
      }
    );

    await step.run("send-notification", async () => {
      const message = issueQueuedTemplate({
        issueTitle: title,
        issueId: issue_id,
        queuedBy: queuedByName,
        meetingTitle,
        meetingDate,
        issueCount,
      });

      await client.sendMessage(settings.channel_id, message);
    });

    return { success: true };
  }
);

/**
 * Notify when rock goes off-track
 */
export const slackRockOffTrack = inngest.createFunction(
  {
    id: "slack-rock-off-track",
    retries: 3,
    idempotency: "event.data.rock_id + ':' + event.data.new_status",
  },
  { event: "rock/status.changed" },
  async ({ event, step }) => {
    const { organization_id, rock_id, title, old_status, new_status, owner_id, rock_level } =
      event.data as {
        organization_id: string;
        rock_id: string;
        title: string;
        old_status: string;
        new_status: string;
        owner_id: string;
        rock_level: string;
      };

    // Only notify for off-track transitions
    if (new_status !== "off_track") {
      return { skipped: true, reason: "not_off_track" };
    }

    const supabase = createAdminClient();

    // Check if Slack notifications are enabled
    const settings = await step.run("get-settings", async () => {
      const { data } = await supabase
        .from("slack_notification_settings")
        .select("channel_id")
        .eq("organization_id", organization_id)
        .eq("event_type", "rock/status.changed")
        .eq("is_enabled", true)
        .single();

      return data;
    });

    if (!settings?.channel_id) {
      return { skipped: true, reason: "notifications_disabled" };
    }

    const client = await SlackClient.fromOrganization(organization_id);
    if (!client) {
      return { skipped: true, reason: "slack_not_connected" };
    }

    // Get owner name
    const ownerName = await step.run("get-owner", async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", owner_id)
        .single();

      return data?.full_name || "Unknown";
    });

    await step.run("send-notification", async () => {
      const message = rockOffTrackTemplate({
        rockTitle: title,
        rockId: rock_id,
        ownerName,
        previousStatus: old_status,
        rockLevel: rock_level,
      });

      await client.sendMessage(settings.channel_id, message);
    });

    return { success: true };
  }
);

/**
 * Send meeting summary after L10 completes
 */
export const slackMeetingSummary = inngest.createFunction(
  {
    id: "slack-meeting-summary",
    retries: 3,
    idempotency: "event.data.meeting_id",
  },
  { event: "l10/meeting.completed" },
  async ({ event, step }) => {
    const { organization_id, meeting_id, title, duration_minutes, rating } = event.data as {
      organization_id: string;
      meeting_id: string;
      title: string;
      duration_minutes: number;
      rating?: number;
    };

    const supabase = createAdminClient();

    // Check if notifications are enabled
    const settings = await step.run("get-settings", async () => {
      const { data } = await supabase
        .from("slack_notification_settings")
        .select("channel_id")
        .eq("organization_id", organization_id)
        .eq("event_type", "l10/meeting.completed")
        .eq("is_enabled", true)
        .single();

      return data;
    });

    if (!settings?.channel_id) {
      return { skipped: true, reason: "notifications_disabled" };
    }

    const client = await SlackClient.fromOrganization(organization_id);
    if (!client) {
      return { skipped: true, reason: "slack_not_connected" };
    }

    // Get meeting stats
    const stats = await step.run("get-stats", async () => {
      const [issuesResult, todosResult] = await Promise.all([
        supabase
          .from("l10_issues_discussed")
          .select("id", { count: "exact", head: true })
          .eq("meeting_id", meeting_id)
          .eq("outcome", "solved"),
        supabase
          .from("todos")
          .select("id", { count: "exact", head: true })
          .eq("meeting_id", meeting_id),
      ]);

      return {
        issuesSolved: issuesResult.count || 0,
        todosCreated: todosResult.count || 0,
      };
    });

    await step.run("send-notification", async () => {
      const message = meetingSummaryTemplate({
        meetingTitle: title || "L10 Meeting",
        meetingId: meeting_id,
        durationMinutes: duration_minutes,
        avgRating: rating,
        issuesSolved: stats.issuesSolved,
        todosCreated: stats.todosCreated,
      });

      await client.sendMessage(settings.channel_id, message);
    });

    return { success: true };
  }
);

/**
 * Daily Slack user sync
 */
export const syncSlackUsers = inngest.createFunction(
  {
    id: "sync-slack-users-daily",
    retries: 2,
  },
  { cron: "0 2 * * *" }, // Daily at 2am
  async ({ step }) => {
    const supabase = createAdminClient();

    // Get all active Slack workspaces
    const workspaces = await step.run("get-workspaces", async () => {
      const { data } = await supabase
        .from("slack_workspaces")
        .select("organization_id")
        .eq("is_active", true);

      return data || [];
    });

    let totalSynced = 0;

    for (const workspace of workspaces) {
      await step.run(`sync-${workspace.organization_id}`, async () => {
        const client = await SlackClient.fromOrganization(workspace.organization_id);
        if (!client) return;

        try {
          const slackUsers = await client.listUsers();

          // Get organization profiles
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, email")
            .eq("organization_id", workspace.organization_id);

          const profilesByEmail = new Map(
            (profiles || []).map((p) => [p.email?.toLowerCase(), p.id])
          );

          for (const member of slackUsers) {
            const slackEmail = member.profile?.email?.toLowerCase();
            const matchedProfileId = slackEmail ? profilesByEmail.get(slackEmail) : null;

            await supabase.from("slack_user_mappings").upsert(
              {
                organization_id: workspace.organization_id,
                slack_user_id: member.id,
                slack_email: member.profile?.email || null,
                slack_username: member.name,
                slack_display_name:
                  member.profile?.display_name || member.profile?.real_name || member.name,
                slack_avatar_url: member.profile?.image_72 || null,
                profile_id: matchedProfileId || null,
                match_method: matchedProfileId ? "auto_email" : null,
                matched_at: matchedProfileId ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: "organization_id,slack_user_id",
              }
            );

            totalSynced++;
          }
        } catch (err) {
          console.error(`Error syncing Slack users for ${workspace.organization_id}:`, err);
        }
      });
    }

    return { workspaces_synced: workspaces.length, users_synced: totalSynced };
  }
);

// Export all Slack functions
export const slackFunctions = [
  slackMeetingReminder,
  slackIssueQueued,
  slackRockOffTrack,
  slackMeetingSummary,
  syncSlackUsers,
];
