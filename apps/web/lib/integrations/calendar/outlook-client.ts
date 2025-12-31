import { createAdminClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/integrations/token-encryption";

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || "common";
const AZURE_TOKEN_URL = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
const GRAPH_API = "https://graph.microsoft.com/v1.0";

export interface OutlookCalendar {
  id: string;
  name: string;
  color?: string;
  isDefaultCalendar?: boolean;
  canEdit: boolean;
  owner?: {
    name: string;
    address: string;
  };
}

export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  bodyPreview?: string;
  body?: {
    contentType: string;
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  recurrence?: {
    pattern: {
      type: string;
      interval: number;
      daysOfWeek?: string[];
    };
    range: {
      type: string;
      startDate: string;
      endDate?: string;
    };
  };
  attendees?: Array<{
    emailAddress: { address: string; name?: string };
    type: string;
    status?: { response: string };
  }>;
  webLink?: string;
  isCancelled?: boolean;
}

export interface CreateEventParams {
  calendarId?: string;
  subject: string;
  body?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  attendeeEmails?: string[];
  recurrence?: {
    pattern: {
      type: "daily" | "weekly" | "absoluteMonthly" | "relativeMonthly" | "absoluteYearly" | "relativeYearly";
      interval: number;
      daysOfWeek?: Array<"sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday">;
    };
    range: {
      type: "noEnd" | "endDate" | "numbered";
      startDate: string;
      endDate?: string;
      numberOfOccurrences?: number;
    };
  };
}

export interface UpdateEventParams {
  subject?: string;
  body?: string;
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
  attendeeEmails?: string[];
}

export class OutlookCalendarClient {
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
  static async fromUserIntegration(profileId: string): Promise<OutlookCalendarClient | null> {
    const supabase = createAdminClient();

    const { data: integration } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("profile_id", profileId)
      .eq("integration_type", "outlook_calendar")
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

    return new OutlookCalendarClient(accessToken, refreshToken, profileId, tokenExpiresAt);
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
    const response = await fetch(AZURE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: AZURE_CLIENT_ID!,
        client_secret: AZURE_CLIENT_SECRET!,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
        scope: "openid profile email offline_access Calendars.ReadWrite",
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

    // Update refresh token if a new one was provided
    if (tokens.refresh_token) {
      this.refreshToken = tokens.refresh_token;
    }

    // Update the stored tokens
    const supabase = createAdminClient();
    const updateData: Record<string, unknown> = {
      access_token: encryptToken(this.accessToken),
      token_expires_at: this.tokenExpiresAt?.toISOString() || null,
      updated_at: new Date().toISOString(),
    };

    if (tokens.refresh_token) {
      updateData.refresh_token = encryptToken(tokens.refresh_token);
    }

    await supabase
      .from("user_integrations")
      .update(updateData)
      .eq("profile_id", this.profileId)
      .eq("integration_type", "outlook_calendar");

    return this.accessToken;
  }

  /**
   * Make an authenticated request to Microsoft Graph API
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.ensureValidToken();

    const response = await fetch(`${GRAPH_API}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Microsoft Graph API error (${method} ${endpoint}):`, error);
      throw new Error(`Microsoft Graph API request failed: ${response.status}`);
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
  async listCalendars(): Promise<OutlookCalendar[]> {
    const response = await this.request<{ value: OutlookCalendar[] }>(
      "GET",
      "/me/calendars"
    );
    return response.value || [];
  }

  /**
   * Get the user's primary (default) calendar
   */
  async getPrimaryCalendar(): Promise<OutlookCalendar | null> {
    const calendars = await this.listCalendars();
    return calendars.find((c) => c.isDefaultCalendar) || calendars[0] || null;
  }

  /**
   * Create a calendar event (supports recurring events)
   */
  async createEvent(params: CreateEventParams): Promise<OutlookCalendarEvent> {
    const endpoint = params.calendarId
      ? `/me/calendars/${params.calendarId}/events`
      : "/me/calendar/events";
    const timeZone = params.timeZone || "Pacific Standard Time";

    const eventBody: Record<string, unknown> = {
      subject: params.subject,
      start: {
        dateTime: params.startDateTime,
        timeZone,
      },
      end: {
        dateTime: params.endDateTime,
        timeZone,
      },
    };

    if (params.body) {
      eventBody.body = {
        contentType: "text",
        content: params.body,
      };
    }

    if (params.attendeeEmails && params.attendeeEmails.length > 0) {
      eventBody.attendees = params.attendeeEmails.map((email) => ({
        emailAddress: { address: email },
        type: "required",
      }));
    }

    if (params.recurrence) {
      eventBody.recurrence = params.recurrence;
    }

    return this.request<OutlookCalendarEvent>("POST", endpoint, eventBody);
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(
    eventId: string,
    params: UpdateEventParams,
    calendarId?: string
  ): Promise<OutlookCalendarEvent> {
    const endpoint = calendarId
      ? `/me/calendars/${calendarId}/events/${eventId}`
      : `/me/calendar/events/${eventId}`;
    const timeZone = params.timeZone || "Pacific Standard Time";

    const eventBody: Record<string, unknown> = {};

    if (params.subject !== undefined) {
      eventBody.subject = params.subject;
    }
    if (params.body !== undefined) {
      eventBody.body = {
        contentType: "text",
        content: params.body,
      };
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
      eventBody.attendees = params.attendeeEmails.map((email) => ({
        emailAddress: { address: email },
        type: "required",
      }));
    }

    return this.request<OutlookCalendarEvent>("PATCH", endpoint, eventBody);
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string, calendarId?: string): Promise<void> {
    const endpoint = calendarId
      ? `/me/calendars/${calendarId}/events/${eventId}`
      : `/me/calendar/events/${eventId}`;
    await this.request<void>("DELETE", endpoint);
  }

  /**
   * Get a specific event by ID
   */
  async getEvent(eventId: string, calendarId?: string): Promise<OutlookCalendarEvent> {
    const endpoint = calendarId
      ? `/me/calendars/${calendarId}/events/${eventId}`
      : `/me/calendar/events/${eventId}`;
    return this.request<OutlookCalendarEvent>("GET", endpoint);
  }

  /**
   * Create a recurring weekly event for L10 meetings
   */
  async createRecurringL10Event(params: {
    subject: string;
    body?: string;
    startDateTime: string; // First occurrence
    endDateTime: string;
    timeZone?: string;
    attendeeEmails?: string[];
    dayOfWeek: "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
    calendarId?: string;
  }): Promise<OutlookCalendarEvent> {
    // Extract date from startDateTime for recurrence start
    const startDate = params.startDateTime.split("T")[0];

    return this.createEvent({
      calendarId: params.calendarId,
      subject: params.subject,
      body: params.body,
      startDateTime: params.startDateTime,
      endDateTime: params.endDateTime,
      timeZone: params.timeZone,
      attendeeEmails: params.attendeeEmails,
      recurrence: {
        pattern: {
          type: "weekly",
          interval: 1,
          daysOfWeek: [params.dayOfWeek],
        },
        range: {
          type: "noEnd",
          startDate,
        },
      },
    });
  }
}
