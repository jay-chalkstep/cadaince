import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

// GET /api/integrations/calendar/google - Initiate Google OAuth flow
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: "Google Calendar integration not configured" },
      { status: 500 }
    );
  }

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

  // Generate secure state parameter
  const state = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store OAuth state in database
  const { error: stateError } = await supabase.from("oauth_states").insert({
    state,
    profile_id: profile.id,
    organization_id: profile.organization_id,
    integration_type: "google_calendar",
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/calendar/google/callback`,
    expires_at: expiresAt.toISOString(),
  });

  if (stateError) {
    console.error("Error creating OAuth state:", stateError);
    return NextResponse.json({ error: "Failed to initiate OAuth" }, { status: 500 });
  }

  // Build authorization URL
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/calendar/google/callback`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent"); // Force refresh token
  authUrl.searchParams.set("state", state);

  return NextResponse.json({ authorization_url: authUrl.toString() });
}

// DELETE /api/integrations/calendar/google - Disconnect Google Calendar
export async function DELETE() {
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

  // Update integration status to disconnected
  const { error } = await supabase
    .from("user_integrations")
    .update({
      status: "disconnected",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", profile.id)
    .eq("integration_type", "google_calendar");

  if (error) {
    console.error("Error disconnecting Google Calendar:", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
