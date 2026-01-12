/**
 * GET /api/integrations-v2/[provider]/oauth/connect
 *
 * Initiates OAuth flow for a provider.
 * Returns the authorization URL to redirect the user to.
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  getOAuthConfig,
  buildAuthorizationUrl,
} from "@/lib/integrations/oauth/config";
import type { IntegrationProvider } from "@/lib/integrations/oauth";

interface RouteParams {
  params: Promise<{ provider: string }>;
}

const OAUTH_PROVIDERS = ["slack", "hubspot", "salesforce", "gong", "salesloft"];

export async function GET(req: Request, { params }: RouteParams) {
  const { provider } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate provider
  if (!OAUTH_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: "Invalid or non-OAuth provider" },
      { status: 400 }
    );
  }

  // Check OAuth is configured for this provider
  const oauthConfig = getOAuthConfig(provider);
  if (!oauthConfig) {
    return NextResponse.json(
      { error: `OAuth not configured for ${provider}` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Get user's profile and check admin access
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 403 }
    );
  }

  if (profile.access_level !== "admin") {
    return NextResponse.json(
      { error: "Admin access required to connect integrations" },
      { status: 403 }
    );
  }

  // Check if already connected
  const { data: existing } = await supabase
    .from("integrations_v2")
    .select("id, status")
    .eq("organization_id", profile.organization_id)
    .eq("provider", provider)
    .single();

  if (existing?.status === "active") {
    return NextResponse.json(
      { error: "Integration already connected. Disconnect first to reconnect." },
      { status: 400 }
    );
  }

  // Generate secure state token
  const state = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Build redirect URI
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/integrations-v2/${provider}/oauth/callback`;

  // Store OAuth state
  const { error: stateError } = await supabase.from("oauth_states").insert({
    state,
    profile_id: profile.id,
    organization_id: profile.organization_id,
    integration_type: provider,
    redirect_uri: redirectUri,
    expires_at: expiresAt.toISOString(),
    metadata: {
      existing_integration_id: existing?.id,
    },
  });

  if (stateError) {
    console.error("Error storing OAuth state:", stateError);
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }

  // Build authorization URL
  const authorizationUrl = buildAuthorizationUrl(
    provider as IntegrationProvider,
    state,
    redirectUri
  );

  if (!authorizationUrl) {
    return NextResponse.json(
      { error: "Failed to build authorization URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ authorization_url: authorizationUrl });
}
