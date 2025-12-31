import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/server";
import { GoogleCalendarClient } from "@/lib/integrations/calendar/google-client";
import { OutlookCalendarClient } from "@/lib/integrations/calendar/outlook-client";

// Day of week mapping
const DAY_MAP_GOOGLE: Record<number, "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA"> = {
  0: "SU",
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
};

const DAY_MAP_OUTLOOK: Record<number, "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday"> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

/**
 * Sync L10 meeting to calendar when created
 * Creates a recurring weekly event (not individual occurrences)
 */
export const syncL10ToCalendar = inngest.createFunction(
  {
    id: "sync-l10-to-calendar",
    retries: 3,
    idempotency: "event.data.meeting_id",
  },
  { event: "l10/meeting.created" },
  async ({ event, step }) => {
    const { meeting_id, organization_id } = event.data as {
      meeting_id: string;
      organization_id: string;
    };

    const supabase = createAdminClient();

    // Step 1: Get meeting details
    const meeting = await step.run("get-meeting", async () => {
      const { data, error } = await supabase
        .from("l10_meetings")
        .select(`
          id,
          title,
          scheduled_at,
          duration_minutes,
          external_calendar_event_id,
          calendar_sync_enabled,
          created_by,
          attendees:l10_meeting_attendees(
            profile:profiles(id, email)
          )
        `)
        .eq("id", meeting_id)
        .eq("organization_id", organization_id)
        .single();

      if (error || !data) {
        throw new Error(`Meeting not found: ${meeting_id}`);
      }
      return data;
    });

    // Don't sync if already synced or sync not enabled
    if (meeting.external_calendar_event_id) {
      return { skipped: true, reason: "already_synced" };
    }

    // Step 2: Check if meeting creator has a calendar integration
    const integration = await step.run("get-integration", async () => {
      const { data } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("profile_id", meeting.created_by)
        .in("integration_type", ["google_calendar", "outlook_calendar"])
        .eq("status", "active")
        .single();

      return data;
    });

    if (!integration) {
      return { skipped: true, reason: "no_calendar_integration" };
    }

    // Step 3: Create calendar event
    const result = await step.run("create-calendar-event", async () => {
      const scheduledAt = new Date(meeting.scheduled_at);
      const durationMs = (meeting.duration_minutes || 90) * 60 * 1000;
      const endAt = new Date(scheduledAt.getTime() + durationMs);
      const dayOfWeek = scheduledAt.getDay();

      // Extract attendee emails
      const attendeeEmails: string[] = [];
      if (meeting.attendees) {
        for (const attendee of meeting.attendees as Array<{ profile: { email: string } | { email: string }[] }>) {
          const profileData = Array.isArray(attendee.profile) ? attendee.profile[0] : attendee.profile;
          if (profileData?.email) {
            attendeeEmails.push(profileData.email);
          }
        }
      }

      const formatDateTime = (date: Date) => date.toISOString();

      let eventId: string;
      let provider: string;

      if (integration.integration_type === "google_calendar") {
        const client = await GoogleCalendarClient.fromUserIntegration(meeting.created_by);
        if (!client) throw new Error("Failed to create Google Calendar client");

        const event = await client.createRecurringL10Event({
          summary: meeting.title || "L10 Meeting",
          description: `L10 Leadership Meeting\n\nManaged by Aicomplice`,
          startDateTime: formatDateTime(scheduledAt),
          endDateTime: formatDateTime(endAt),
          attendeeEmails,
          dayOfWeek: DAY_MAP_GOOGLE[dayOfWeek],
        });
        eventId = event.id;
        provider = "google";
      } else {
        const client = await OutlookCalendarClient.fromUserIntegration(meeting.created_by);
        if (!client) throw new Error("Failed to create Outlook Calendar client");

        const event = await client.createRecurringL10Event({
          subject: meeting.title || "L10 Meeting",
          body: `L10 Leadership Meeting\n\nManaged by Aicomplice`,
          startDateTime: formatDateTime(scheduledAt),
          endDateTime: formatDateTime(endAt),
          attendeeEmails,
          dayOfWeek: DAY_MAP_OUTLOOK[dayOfWeek],
        });
        eventId = event.id;
        provider = "outlook";
      }

      // Update meeting with calendar sync info
      await supabase
        .from("l10_meetings")
        .update({
          external_calendar_event_id: eventId,
          external_calendar_provider: provider,
          calendar_sync_enabled: true,
        })
        .eq("id", meeting_id);

      return { eventId, provider };
    });

    return { success: true, ...result };
  }
);

/**
 * Update calendar event when L10 meeting is updated
 */
export const updateCalendarEvent = inngest.createFunction(
  {
    id: "update-calendar-event",
    retries: 3,
  },
  { event: "l10/meeting.updated" },
  async ({ event, step }) => {
    const { meeting_id, organization_id, updated_fields } = event.data as {
      meeting_id: string;
      organization_id: string;
      updated_fields?: string[];
    };

    // Only update if relevant fields changed
    const relevantFields = ["title", "scheduled_at", "duration_minutes"];
    const hasRelevantChanges = updated_fields?.some((f) => relevantFields.includes(f));

    if (!hasRelevantChanges) {
      return { skipped: true, reason: "no_relevant_changes" };
    }

    const supabase = createAdminClient();

    // Step 1: Get meeting with calendar info
    const meeting = await step.run("get-meeting", async () => {
      const { data, error } = await supabase
        .from("l10_meetings")
        .select(`
          id,
          title,
          scheduled_at,
          duration_minutes,
          external_calendar_event_id,
          external_calendar_provider,
          calendar_sync_enabled,
          created_by,
          attendees:l10_meeting_attendees(
            profile:profiles(id, email)
          )
        `)
        .eq("id", meeting_id)
        .eq("organization_id", organization_id)
        .single();

      if (error || !data) {
        throw new Error(`Meeting not found: ${meeting_id}`);
      }
      return data;
    });

    // Skip if no calendar event linked
    if (!meeting.external_calendar_event_id || !meeting.calendar_sync_enabled) {
      return { skipped: true, reason: "not_synced_to_calendar" };
    }

    // Step 2: Update calendar event
    await step.run("update-calendar-event", async () => {
      const scheduledAt = new Date(meeting.scheduled_at);
      const durationMs = (meeting.duration_minutes || 90) * 60 * 1000;
      const endAt = new Date(scheduledAt.getTime() + durationMs);

      // Extract attendee emails
      const attendeeEmails: string[] = [];
      if (meeting.attendees) {
        for (const attendee of meeting.attendees as Array<{ profile: { email: string } | { email: string }[] }>) {
          const profileData = Array.isArray(attendee.profile) ? attendee.profile[0] : attendee.profile;
          if (profileData?.email) {
            attendeeEmails.push(profileData.email);
          }
        }
      }

      const formatDateTime = (date: Date) => date.toISOString();

      if (meeting.external_calendar_provider === "google") {
        const client = await GoogleCalendarClient.fromUserIntegration(meeting.created_by);
        if (!client) throw new Error("Failed to create Google Calendar client");

        await client.updateEvent(meeting.external_calendar_event_id, {
          summary: meeting.title || "L10 Meeting",
          description: `L10 Leadership Meeting\n\nManaged by Aicomplice`,
          startDateTime: formatDateTime(scheduledAt),
          endDateTime: formatDateTime(endAt),
          attendeeEmails,
        });
      } else if (meeting.external_calendar_provider === "outlook") {
        const client = await OutlookCalendarClient.fromUserIntegration(meeting.created_by);
        if (!client) throw new Error("Failed to create Outlook Calendar client");

        await client.updateEvent(meeting.external_calendar_event_id, {
          subject: meeting.title || "L10 Meeting",
          body: `L10 Leadership Meeting\n\nManaged by Aicomplice`,
          startDateTime: formatDateTime(scheduledAt),
          endDateTime: formatDateTime(endAt),
          attendeeEmails,
        });
      }
    });

    return { success: true, event_id: meeting.external_calendar_event_id };
  }
);

// Export all calendar functions
export const calendarFunctions = [syncL10ToCalendar, updateCalendarEvent];
