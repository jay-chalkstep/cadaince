/**
 * GET /api/integrations-v2/[provider]/oauth/callback
 *
 * OAuth callback handler. Exchanges authorization code for tokens
 * and stores the integration in the database.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { encryptToken } from "@/lib/integrations/token-encryption";
import { exchangeCodeForTokens } from "@/lib/integrations/oauth/config";
import type { IntegrationProvider } from "@/lib/integrations/oauth";

interface RouteParams {
  params: Promise<{ provider: string }>;
}

const OAUTH_PROVIDERS = ["slack", "hubspot", "salesforce", "gong", "salesloft"];

export async function GET(req: Request, { params }: RouteParams) {
  const { provider } = await params;
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const settingsUrl = `${baseUrl}/settings/integrations`;

  // Handle OAuth errors from provider
  if (error) {
    console.error(`OAuth error from ${provider}:`, error, errorDescription);
    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  // Validate required params
  if (!code || !state) {
    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent("Missing authorization code or state")}`
    );
  }

  // Validate provider
  if (!OAUTH_PROVIDERS.includes(provider)) {
    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent("Invalid provider")}`
    );
  }

  const supabase = createAdminClient();

  // Verify state token
  const { data: oauthState, error: stateError } = await supabase
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .single();

  if (stateError || !oauthState) {
    console.error("OAuth state not found:", stateError);
    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent("Invalid or expired OAuth state. Please try again.")}`
    );
  }

  // Check state expiry
  if (new Date(oauthState.expires_at) < new Date()) {
    // Clean up expired state
    await supabase.from("oauth_states").delete().eq("id", oauthState.id);

    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent("OAuth session expired. Please try again.")}`
    );
  }

  // Check provider matches
  if (oauthState.integration_type !== provider) {
    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent("Provider mismatch in OAuth callback")}`
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(
      provider as IntegrationProvider,
      code,
      oauthState.redirect_uri
    );

    // Encrypt tokens
    const accessTokenEncrypted = encryptToken(tokens.access_token);
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Calculate token expiry
    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Build integration data
    const integrationData = {
      organization_id: oauthState.organization_id,
      provider,
      display_name: getProviderDisplayName(provider, tokens),
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      token_expires_at: tokenExpiresAt,
      oauth_scope: tokens.scope || null,
      external_account_id: getExternalAccountId(provider, tokens),
      external_account_name: getExternalAccountName(provider, tokens),
      status: "active" as const,
      status_message: null,
      last_successful_connection_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
      connected_by_profile_id: oauthState.profile_id,
      config: getProviderConfig(provider, tokens),
    };

    // Check for existing integration to update
    const existingId = (oauthState.metadata as { existing_integration_id?: string })
      ?.existing_integration_id;

    if (existingId) {
      // Update existing
      const { error: updateError } = await supabase
        .from("integrations_v2")
        .update(integrationData)
        .eq("id", existingId);

      if (updateError) {
        throw updateError;
      }
    } else {
      // Check if one exists now (race condition protection)
      const { data: existing } = await supabase
        .from("integrations_v2")
        .select("id")
        .eq("organization_id", oauthState.organization_id)
        .eq("provider", provider)
        .single();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from("integrations_v2")
          .update(integrationData)
          .eq("id", existing.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from("integrations_v2")
          .insert(integrationData);

        if (insertError) {
          throw insertError;
        }
      }
    }

    // Clean up OAuth state
    await supabase.from("oauth_states").delete().eq("id", oauthState.id);

    // Redirect to settings with success message
    return NextResponse.redirect(
      `${settingsUrl}?success=${encodeURIComponent(`${getProviderName(provider)} connected successfully`)}`
    );
  } catch (err) {
    console.error(`OAuth callback error for ${provider}:`, err);

    // Clean up OAuth state
    await supabase.from("oauth_states").delete().eq("id", oauthState.id);

    const errorMessage =
      err instanceof Error ? err.message : "Failed to connect integration";

    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent(errorMessage)}`
    );
  }
}

// Helper functions for provider-specific data extraction

function getProviderDisplayName(
  provider: string,
  tokens: Record<string, unknown>
): string {
  switch (provider) {
    case "slack":
      return (tokens.team_name as string) || "Slack";
    case "hubspot":
      return "HubSpot";
    case "salesforce":
      return "Salesforce";
    case "gong":
      return "Gong";
    case "salesloft":
      return "Salesloft";
    default:
      return provider;
  }
}

function getProviderName(provider: string): string {
  const names: Record<string, string> = {
    slack: "Slack",
    hubspot: "HubSpot",
    salesforce: "Salesforce",
    gong: "Gong",
    salesloft: "Salesloft",
  };
  return names[provider] || provider;
}

function getExternalAccountId(
  provider: string,
  tokens: Record<string, unknown>
): string | null {
  switch (provider) {
    case "slack":
      return (tokens.team_id as string) || null;
    default:
      return null;
  }
}

function getExternalAccountName(
  provider: string,
  tokens: Record<string, unknown>
): string | null {
  switch (provider) {
    case "slack":
      return (tokens.team_name as string) || null;
    default:
      return null;
  }
}

function getProviderConfig(
  provider: string,
  tokens: Record<string, unknown>
): Record<string, unknown> {
  switch (provider) {
    case "slack":
      return {
        bot_user_id: tokens.bot_user_id,
      };
    case "salesforce":
      return {
        instance_url: tokens.instance_url,
      };
    default:
      return {};
  }
}
