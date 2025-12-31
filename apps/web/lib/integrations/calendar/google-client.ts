import { createAdminClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/integrations/token-encryption";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole: "owner" | "writer" | "reader" | "freeBusyReader";
  backgroundColor?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  recurrence?: string[];
  attendees?: Array<{ email: string; responseStatus?: string }>;
  htmlLink?: string;
  status?: string;
}

export interface CreateEventParams {
  calendarId?: string;
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  attendeeEmails?: string[];
  recurrence?: string[]; // RRULE strings like "RRULE:FREQ=WEEKLY;BYDAY=TU"
}

export interface UpdateEventParams {
  summary?: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
  attendeeEmails?: string[];
}

export class GoogleCalendarClient {
  private accessToken: string;
  private refreshToken: string | null;
  private profileId: string;
  private tokenExpiresAt: Date | null;

  constructor(
    accessToken: string,
    refreshToken: string | null,
    profileId: string,
    tokenExpiresAt?: Date | null
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.profileId = profileId;
    this.tokenExpiresAt = tokenExpiresAt || null;
  }

  /**
   * Create a client from a user integration record
   */
  static async fromUserIntegration(profileId: string): Promise<GoogleCalendarClient | null> {
    const supabase = createAdminClient();

    const { data: integration } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("profile_id", profileId)
      .eq("integration_type", "google_calendar")
      .eq("status", "active")
      .single();

    if (!integration || !integration.access_token) {
      return null;
    }

    const accessToken = decryptToken(integration.access_token);
    const refreshToken = integration.refresh_token
      ? decryptToken(integration.refresh_token)
      : null;
    const tokenExpiresAt = integration.token_expires_at
      ? new Date(integration.token_expires_at)
      : null;

    return new GoogleCalendarClient(accessToken, refreshToken, profileId, tokenExpiresAt);
  }

  /**
   * Refresh the access token if expired or about to expire
   */
  private async ensureValidToken(): Promise<string> {
    // Check if token is expired or will expire in the next 5 minutes
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    const isExpired = this.tokenExpiresAt && new Date() > new Date(this.tokenExpiresAt.getTime() - bufferTime);

    if (!isExpired) {
      return this.accessToken;
    }

    if (!this.refreshToken) {
      throw new Error("Token expired and no refresh token available");
    }

    // Refresh the token
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Token refresh failed:", error);
      throw new Error("Failed to refresh access token");
    }

    const tokens = await response.json();
    this.accessToken = tokens.access_token;
    this.tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    // Update the stored token
    const supabase = createAdminClient();
    await supabase
      .from("user_integrations")
      .update({
        access_token: encryptToken(this.accessToken),
        token_expires_at: this.tokenExpiresAt?.toISOString() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("profile_id", this.profileId)
      .eq("integration_type", "google_calendar");

    return this.accessToken;
  }

  /**
   * Make an authenticated request to Google Calendar API
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.ensureValidToken();

    const response = await fetch(`${GOOGLE_CALENDAR_API}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Google Calendar API error (${method} ${endpoint}):`, error);
      throw new Error(`Google Calendar API request failed: ${response.status}`);
    }

    // DELETE requests may not return a body
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  /**
   * List user's calendars
   */
  async listCalendars(): Promise<GoogleCalendar[]> {
    const response = await this.request<{ items: GoogleCalendar[] }>(
      "GET",
      "/users/me/calendarList"
    );
    return response.items || [];
  }

  /**
   * Get the user's primary calendar
   */
  async getPrimaryCalendar(): Promise<GoogleCalendar | null> {
    const calendars = await this.listCalendars();
    return calendars.find((c) => c.primary) || calendars[0] || null;
  }

  /**
   * Create a calendar event (supports recurring events)
   */
  async createEvent(params: CreateEventParams): Promise<GoogleCalendarEvent> {
    const calendarId = params.calendarId || "primary";
    const timeZone = params.timeZone || "America/Los_Angeles";

    const eventBody: Record<string, unknown> = {
      summary: params.summary,
      description: params.description,
      start: {
        dateTime: params.startDateTime,
        timeZone,
      },
      end: {
        dateTime: params.endDateTime,
        timeZone,
      },
    };

    if (params.attendeeEmails && params.attendeeEmails.length > 0) {
      eventBody.attendees = params.attendeeEmails.map((email) => ({ email }));
    }

    if (params.recurrence && params.recurrence.length > 0) {
      eventBody.recurrence = params.recurrence;
    }

    return this.request<GoogleCalendarEvent>(
      "POST",
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      eventBody
    );
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(
    eventId: string,
    params: UpdateEventParams,
    calendarId: string = "primary"
  ): Promise<GoogleCalendarEvent> {
    const timeZone = params.timeZone || "America/Los_Angeles";

    const eventBody: Record<string, unknown> = {};

    if (params.summary !== undefined) {
      eventBody.summary = params.summary;
    }
    if (params.description !== undefined) {
      eventBody.description = params.description;
    }
    if (params.startDateTime) {
      eventBody.start = {
        dateTime: params.startDateTime,
        timeZone,
      };
    }
    if (params.endDateTime) {
      eventBody.end = {
        dateTime: params.endDateTime,
        timeZone,
      };
    }
    if (params.attendeeEmails) {
      eventBody.attendees = params.attendeeEmails.map((email) => ({ email }));
    }

    return this.request<GoogleCalendarEvent>(
      "PATCH",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      eventBody
    );
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string, calendarId: string = "primary"): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    );
  }

  /**
   * Get a specific event by ID
   */
  async getEvent(eventId: string, calendarId: string = "primary"): Promise<GoogleCalendarEvent> {
    return this.request<GoogleCalendarEvent>(
      "GET",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    );
  }

  /**
   * Create a recurring weekly event for L10 meetings
   */
  async createRecurringL10Event(params: {
    summary: string;
    description?: string;
    startDateTime: string; // First occurrence
    endDateTime: string;
    timeZone?: string;
    attendeeEmails?: string[];
    dayOfWeek: "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";
    calendarId?: string;
  }): Promise<GoogleCalendarEvent> {
    return this.createEvent({
      calendarId: params.calendarId,
      summary: params.summary,
      description: params.description,
      startDateTime: params.startDateTime,
      endDateTime: params.endDateTime,
      timeZone: params.timeZone,
      attendeeEmails: params.attendeeEmails,
      recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${params.dayOfWeek}`],
    });
  }
}
