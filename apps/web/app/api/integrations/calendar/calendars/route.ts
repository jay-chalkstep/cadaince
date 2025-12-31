import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GoogleCalendarClient } from "@/lib/integrations/calendar/google-client";
import { OutlookCalendarClient } from "@/lib/integrations/calendar/outlook-client";

interface CalendarListItem {
  id: string;
  name: string;
  provider: "google" | "outlook";
  primary?: boolean;
  color?: string;
}

// GET /api/integrations/calendar/calendars - List user's connected calendars
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get user's active calendar integrations
  const { data: integrations } = await supabase
    .from("user_integrations")
    .select("integration_type, status, config")
    .eq("profile_id", profile.id)
    .in("integration_type", ["google_calendar", "outlook_calendar"])
    .eq("status", "active");

  const calendars: CalendarListItem[] = [];
  const errors: { provider: string; error: string }[] = [];

  // Fetch calendars from each connected provider
  for (const integration of integrations || []) {
    try {
      if (integration.integration_type === "google_calendar") {
        const client = await GoogleCalendarClient.fromUserIntegration(profile.id);
        if (client) {
          const googleCalendars = await client.listCalendars();
          for (const cal of googleCalendars) {
            calendars.push({
              id: cal.id,
              name: cal.summary,
              provider: "google",
              primary: cal.primary,
              color: cal.backgroundColor,
            });
          }
        }
      } else if (integration.integration_type === "outlook_calendar") {
        const client = await OutlookCalendarClient.fromUserIntegration(profile.id);
        if (client) {
          const outlookCalendars = await client.listCalendars();
          for (const cal of outlookCalendars) {
            calendars.push({
              id: cal.id,
              name: cal.name,
              provider: "outlook",
              primary: cal.isDefaultCalendar,
              color: cal.color,
            });
          }
        }
      }
    } catch (err) {
      console.error(`Error fetching ${integration.integration_type} calendars:`, err);
      errors.push({
        provider: integration.integration_type,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    calendars,
    errors: errors.length > 0 ? errors : undefined,
  });
}
