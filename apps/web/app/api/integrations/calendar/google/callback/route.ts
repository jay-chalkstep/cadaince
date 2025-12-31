import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { encryptToken } from "@/lib/integrations/token-encryption";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// GET /api/integrations/calendar/google/callback - Handle OAuth callback
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const supabase = createAdminClient();

  // Handle OAuth errors
  if (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=oauth_denied`
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
    // Clean up expired state
    await supabase.from("oauth_states").delete().eq("id", oauthState.id);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=state_expired`
    );
  }

  // Clean up the used state
  await supabase.from("oauth_states").delete().eq("id", oauthState.id);

  // Exchange code for tokens
  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: oauthState.redirect_uri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();

    // Get user info to identify the Google account
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let googleEmail = null;
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      googleEmail = userInfo.email;
    }

    // Calculate token expiration
    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Upsert user integration
    const { error: upsertError } = await supabase
      .from("user_integrations")
      .upsert(
        {
          profile_id: oauthState.profile_id,
          organization_id: oauthState.organization_id,
          integration_type: "google_calendar",
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt?.toISOString() || null,
          config: {
            google_email: googleEmail,
            scopes: tokens.scope?.split(" ") || [],
          },
          status: "active",
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "profile_id,integration_type",
        }
      );

    if (upsertError) {
      console.error("Error saving integration:", upsertError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=save_failed`
      );
    }

    // Redirect to settings with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=google_calendar_connected`
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=unexpected_error`
    );
  }
}
