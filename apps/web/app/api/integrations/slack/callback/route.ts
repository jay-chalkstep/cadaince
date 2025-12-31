import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { encryptToken } from "@/lib/integrations/token-encryption";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;

// GET /api/integrations/slack/callback - Handle Slack OAuth callback
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const supabase = createAdminClient();

  // Handle OAuth errors
  if (error) {
    console.error("Slack OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=slack_oauth_denied`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=missing_params`
    );
  }

  // Verify state parameter
  const { data: oauthState, error: stateError } = await supabase
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .single();

  if (stateError || !oauthState) {
    console.error("Invalid OAuth state:", stateError);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_state`
    );
  }

  // Check if state has expired
  if (new Date(oauthState.expires_at) < new Date()) {
    await supabase.from("oauth_states").delete().eq("id", oauthState.id);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=state_expired`
    );
  }

  // Clean up the used state
  await supabase.from("oauth_states").delete().eq("id", oauthState.id);

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID!,
        client_secret: SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: oauthState.redirect_uri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error("Slack token exchange failed:", tokenData.error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=token_exchange_failed`
      );
    }

    // Extract workspace info
    const workspaceId = tokenData.team?.id;
    const workspaceName = tokenData.team?.name;
    const botUserId = tokenData.bot_user_id;
    const accessToken = tokenData.access_token;

    if (!workspaceId || !accessToken) {
      console.error("Missing workspace data from Slack");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_response`
      );
    }

    // Encrypt access token before storing
    const encryptedToken = encryptToken(accessToken);

    // Get team icon
    let teamIconUrl = null;
    try {
      const teamInfoResponse = await fetch("https://slack.com/api/team.info", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const teamInfo = await teamInfoResponse.json();
      if (teamInfo.ok && teamInfo.team?.icon) {
        teamIconUrl = teamInfo.team.icon.image_132 || teamInfo.team.icon.image_88;
      }
    } catch (err) {
      console.error("Failed to fetch team info:", err);
    }

    // Create workspace record
    const { error: insertError } = await supabase.from("slack_workspaces").insert({
      organization_id: oauthState.organization_id,
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      access_token: encryptedToken,
      bot_user_id: botUserId,
      team_icon_url: teamIconUrl,
      connected_by: oauthState.profile_id,
      connected_at: new Date().toISOString(),
      is_active: true,
    });

    if (insertError) {
      console.error("Error saving Slack workspace:", insertError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=save_failed`
      );
    }

    // Auto-sync users in background (trigger via Inngest)
    // For now, we'll do a quick sync here
    await syncSlackUsers(accessToken, oauthState.organization_id, supabase);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=slack_connected`
    );
  } catch (err) {
    console.error("Slack OAuth callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=unexpected_error`
    );
  }
}

// Helper to sync Slack users and auto-map by email
async function syncSlackUsers(
  accessToken: string,
  organizationId: string,
  supabase: ReturnType<typeof createAdminClient>
) {
  try {
    // Fetch Slack users
    const usersResponse = await fetch("https://slack.com/api/users.list", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const usersData = await usersResponse.json();
    if (!usersData.ok || !usersData.members) {
      console.error("Failed to fetch Slack users:", usersData.error);
      return;
    }

    // Get all profiles in the organization
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("organization_id", organizationId);

    const profilesByEmail = new Map(
      (profiles || []).map((p) => [p.email?.toLowerCase(), p.id])
    );

    // Process each Slack user (skip bots and deleted users)
    for (const member of usersData.members) {
      if (member.is_bot || member.deleted || member.id === "USLACKBOT") {
        continue;
      }

      const slackEmail = member.profile?.email?.toLowerCase();
      const matchedProfileId = slackEmail ? profilesByEmail.get(slackEmail) : null;

      await supabase.from("slack_user_mappings").upsert(
        {
          organization_id: organizationId,
          slack_user_id: member.id,
          slack_email: member.profile?.email || null,
          slack_username: member.name,
          slack_display_name: member.profile?.display_name || member.profile?.real_name || member.name,
          slack_avatar_url: member.profile?.image_72 || null,
          profile_id: matchedProfileId || null,
          match_method: matchedProfileId ? "auto_email" : null,
          matched_at: matchedProfileId ? new Date().toISOString() : null,
        },
        {
          onConflict: "organization_id,slack_user_id",
        }
      );
    }
  } catch (err) {
    console.error("Error syncing Slack users:", err);
  }
}
