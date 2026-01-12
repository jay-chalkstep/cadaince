/**
 * POST /api/integrations-v2/[provider]/oauth/refresh
 *
 * Manually triggers a token refresh for an integration.
 * Useful when a token has expired and needs immediate refresh.
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { refreshIntegrationToken } from "@/lib/integrations/oauth/token-refresh";

interface RouteParams {
  params: Promise<{ provider: string }>;
}

const REFRESHABLE_PROVIDERS = ["hubspot", "salesforce", "gong", "salesloft"];

export async function POST(req: Request, { params }: RouteParams) {
  const { provider } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate provider supports refresh
  if (!REFRESHABLE_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: `Provider ${provider} does not support token refresh` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Get user's profile and check admin access
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, access_level")
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
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  // Find the integration
  const { data: integration, error: findError } = await supabase
    .from("integrations_v2")
    .select("id, status, refresh_token_encrypted")
    .eq("organization_id", profile.organization_id)
    .eq("provider", provider)
    .single();

  if (findError || !integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  if (!integration.refresh_token_encrypted) {
    return NextResponse.json(
      { error: "No refresh token available for this integration" },
      { status: 400 }
    );
  }

  // Attempt to refresh
  const success = await refreshIntegrationToken(integration.id);

  if (!success) {
    // Fetch updated error info
    const { data: updated } = await supabase
      .from("integrations_v2")
      .select("last_error, status")
      .eq("id", integration.id)
      .single();

    return NextResponse.json(
      {
        error: "Token refresh failed",
        details: updated?.last_error || "Unknown error",
        status: updated?.status,
      },
      { status: 500 }
    );
  }

  // Fetch updated integration
  const { data: refreshedIntegration } = await supabase
    .from("integrations_v2")
    .select(
      `
      id,
      provider,
      status,
      token_expires_at,
      last_successful_connection_at
    `
    )
    .eq("id", integration.id)
    .single();

  return NextResponse.json({
    success: true,
    message: "Token refreshed successfully",
    integration: refreshedIntegration,
  });
}
