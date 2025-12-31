import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_AUTH_URL = "https://slack.com/oauth/v2/authorize";

// Scopes for bot token
const BOT_SCOPES = [
  "chat:write",
  "chat:write.public",
  "commands",
  "channels:read",
  "users:read",
  "users:read.email",
  "team:read",
];

// GET /api/integrations/slack/oauth - Initiate Slack OAuth flow
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SLACK_CLIENT_ID) {
    return NextResponse.json(
      { error: "Slack integration not configured" },
      { status: 500 }
    );
  }

  const supabase = createAdminClient();

  // Get user's profile and check admin status
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admins can connect Slack (org-level integration)
  if (profile.access_level !== "admin") {
    return NextResponse.json(
      { error: "Only admins can connect Slack" },
      { status: 403 }
    );
  }

  // Check if already connected
  const { data: existingWorkspace } = await supabase
    .from("slack_workspaces")
    .select("id, workspace_name")
    .eq("organization_id", profile.organization_id)
    .eq("is_active", true)
    .single();

  if (existingWorkspace) {
    return NextResponse.json(
      {
        error: "Slack already connected",
        workspace_name: existingWorkspace.workspace_name,
      },
      { status: 400 }
    );
  }

  // Generate secure state parameter
  const state = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store OAuth state in database
  const { error: stateError } = await supabase.from("oauth_states").insert({
    state,
    profile_id: profile.id,
    organization_id: profile.organization_id,
    integration_type: "slack",
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/slack/callback`,
    expires_at: expiresAt.toISOString(),
  });

  if (stateError) {
    console.error("Error creating OAuth state:", stateError);
    return NextResponse.json({ error: "Failed to initiate OAuth" }, { status: 500 });
  }

  // Build authorization URL
  const authUrl = new URL(SLACK_AUTH_URL);
  authUrl.searchParams.set("client_id", SLACK_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/slack/callback`);
  authUrl.searchParams.set("scope", BOT_SCOPES.join(","));
  authUrl.searchParams.set("state", state);

  return NextResponse.json({ authorization_url: authUrl.toString() });
}
