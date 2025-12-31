import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
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

// POST /api/integrations/calendar/sync - Sync L10 meeting to calendar
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const body = await req.json();
  const { meeting_id, provider, calendar_id, action } = body as {
    meeting_id: string;
    provider: "google" | "outlook";
    calendar_id?: string;
    action?: "create" | "update" | "delete";
  };

  if (!meeting_id || !provider) {
    return NextResponse.json(
      { error: "meeting_id and provider are required" },
      { status: 400 }
    );
  }

  // Get the L10 meeting with attendees
  const { data: meeting, error: meetingError } = await supabase
    .from("l10_meetings")
    .select(`
      id,
      title,
      scheduled_at,
      duration_minutes,
      external_calendar_event_id,
      external_calendar_provider,
      calendar_sync_enabled,
      organization_id,
      attendees:l10_meeting_attendees(
        profile:profiles(id, email)
      )
    `)
    .eq("id", meeting_id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Get the calendar client based on provider
  let client: GoogleCalendarClient | OutlookCalendarClient | null = null;

  if (provider === "google") {
    client = await GoogleCalendarClient.fromUserIntegration(profile.id);
  } else if (provider === "outlook") {
    client = await OutlookCalendarClient.fromUserIntegration(profile.id);
  }

  if (!client) {
    return NextResponse.json(
      { error: `${provider} calendar not connected` },
      { status: 400 }
    );
  }

  try {
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

    // Format datetime for API
    const formatDateTime = (date: Date) => date.toISOString();

    // Handle delete action
    if (action === "delete" && meeting.external_calendar_event_id) {
      if (provider === "google") {
        await (client as GoogleCalendarClient).deleteEvent(
          meeting.external_calendar_event_id,
          calendar_id || "primary"
        );
      } else {
        await (client as OutlookCalendarClient).deleteEvent(
          meeting.external_calendar_event_id,
          calendar_id
        );
      }

      // Update meeting record
      await supabase
        .from("l10_meetings")
        .update({
          external_calendar_event_id: null,
          external_calendar_provider: null,
          calendar_sync_enabled: false,
        })
        .eq("id", meeting_id);

      return NextResponse.json({ success: true, action: "deleted" });
    }

    // Handle update action
    if (action === "update" && meeting.external_calendar_event_id) {
      if (provider === "google") {
        await (client as GoogleCalendarClient).updateEvent(
          meeting.external_calendar_event_id,
          {
            summary: meeting.title || "L10 Meeting",
            description: `L10 Leadership Meeting\n\nManaged by Aicomplice`,
            startDateTime: formatDateTime(scheduledAt),
            endDateTime: formatDateTime(endAt),
            attendeeEmails,
          },
          calendar_id || "primary"
        );
      } else {
        await (client as OutlookCalendarClient).updateEvent(
          meeting.external_calendar_event_id,
          {
            subject: meeting.title || "L10 Meeting",
            body: `L10 Leadership Meeting\n\nManaged by Aicomplice`,
            startDateTime: formatDateTime(scheduledAt),
            endDateTime: formatDateTime(endAt),
            attendeeEmails,
          },
          calendar_id
        );
      }

      return NextResponse.json({ success: true, action: "updated" });
    }

    // Handle create action (or no action specified)
    // Create a recurring weekly event
    let eventId: string;

    if (provider === "google") {
      const event = await (client as GoogleCalendarClient).createRecurringL10Event({
        summary: meeting.title || "L10 Meeting",
        description: `L10 Leadership Meeting\n\nManaged by Aicomplice`,
        startDateTime: formatDateTime(scheduledAt),
        endDateTime: formatDateTime(endAt),
        attendeeEmails,
        dayOfWeek: DAY_MAP_GOOGLE[dayOfWeek],
        calendarId: calendar_id || "primary",
      });
      eventId = event.id;
    } else {
      const event = await (client as OutlookCalendarClient).createRecurringL10Event({
        subject: meeting.title || "L10 Meeting",
        body: `L10 Leadership Meeting\n\nManaged by Aicomplice`,
        startDateTime: formatDateTime(scheduledAt),
        endDateTime: formatDateTime(endAt),
        attendeeEmails,
        dayOfWeek: DAY_MAP_OUTLOOK[dayOfWeek],
        calendarId: calendar_id,
      });
      eventId = event.id;
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

    return NextResponse.json({
      success: true,
      action: "created",
      event_id: eventId,
    });
  } catch (err) {
    console.error("Calendar sync error:", err);
    return NextResponse.json(
      {
        error: "Failed to sync with calendar",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
