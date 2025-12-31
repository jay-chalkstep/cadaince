import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || "common";
const AZURE_AUTH_URL = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize`;
const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "Calendars.ReadWrite",
];

// GET /api/integrations/calendar/outlook - Initiate Microsoft OAuth flow
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!AZURE_CLIENT_ID) {
    return NextResponse.json(
      { error: "Outlook Calendar integration not configured" },
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
    integration_type: "outlook_calendar",
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/calendar/outlook/callback`,
    expires_at: expiresAt.toISOString(),
  });

  if (stateError) {
    console.error("Error creating OAuth state:", stateError);
    return NextResponse.json({ error: "Failed to initiate OAuth" }, { status: 500 });
  }

  // Build authorization URL
  const authUrl = new URL(AZURE_AUTH_URL);
  authUrl.searchParams.set("client_id", AZURE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/calendar/outlook/callback`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("state", state);

  return NextResponse.json({ authorization_url: authUrl.toString() });
}

// DELETE /api/integrations/calendar/outlook - Disconnect Outlook Calendar
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
    .eq("integration_type", "outlook_calendar");

  if (error) {
    console.error("Error disconnecting Outlook Calendar:", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
