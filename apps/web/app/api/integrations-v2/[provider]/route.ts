/**
 * GET /api/integrations-v2/[provider] - Get integration status for a provider
 * PATCH /api/integrations-v2/[provider] - Update integration config
 * DELETE /api/integrations-v2/[provider] - Disconnect integration
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { IntegrationProvider } from "@/lib/integrations/oauth";

interface RouteParams {
  params: Promise<{ provider: string }>;
}

const VALID_PROVIDERS = [
  "slack",
  "hubspot",
  "salesforce",
  "gong",
  "salesloft",
  "bigquery",
];

export async function GET(req: Request, { params }: RouteParams) {
  const { provider } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 403 }
    );
  }

  // Fetch integration for this provider
  const { data: integration, error } = await supabase
    .from("integrations_v2")
    .select(
      `
      id,
      provider,
      display_name,
      status,
      status_message,
      external_account_id,
      external_account_name,
      oauth_scope,
      last_successful_connection_at,
      last_error,
      last_error_at,
      config,
      created_at,
      updated_at
    `
    )
    .eq("organization_id", profile.organization_id)
    .eq("provider", provider)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is "not found"
    console.error("Error fetching integration:", error);
    return NextResponse.json(
      { error: "Failed to fetch integration" },
      { status: 500 }
    );
  }

  if (!integration) {
    return NextResponse.json({ connected: false, provider });
  }

  // Get data source count
  const { count } = await supabase
    .from("data_sources_v2")
    .select("*", { count: "exact", head: true })
    .eq("integration_id", integration.id);

  return NextResponse.json({
    ...integration,
    connected: integration.status === "active",
    data_source_count: count || 0,
  });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { provider } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
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

  // Parse request body
  let body: { display_name?: string; config?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Find the integration
  const { data: existing, error: findError } = await supabase
    .from("integrations_v2")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("provider", provider)
    .single();

  if (findError || !existing) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  // Update integration
  const updateData: Record<string, unknown> = {};
  if (body.display_name !== undefined) {
    updateData.display_name = body.display_name;
  }
  if (body.config !== undefined) {
    updateData.config = body.config;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("integrations_v2")
    .update(updateData)
    .eq("id", existing.id)
    .select()
    .single();

  if (updateError) {
    console.error("Error updating integration:", updateError);
    return NextResponse.json(
      { error: "Failed to update integration" },
      { status: 500 }
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const { provider } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
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
  const { data: existing, error: findError } = await supabase
    .from("integrations_v2")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("provider", provider)
    .single();

  if (findError || !existing) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  // Check for dependent data sources
  const { count } = await supabase
    .from("data_sources_v2")
    .select("*", { count: "exact", head: true })
    .eq("integration_id", existing.id);

  // Update status to disconnected (soft delete)
  // This preserves data sources but marks the integration as disconnected
  const { error: updateError } = await supabase
    .from("integrations_v2")
    .update({
      status: "disconnected",
      status_message: "Disconnected by user",
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      token_expires_at: null,
      service_account_json_encrypted: null,
    })
    .eq("id", existing.id);

  if (updateError) {
    console.error("Error disconnecting integration:", updateError);
    return NextResponse.json(
      { error: "Failed to disconnect integration" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `${provider} integration disconnected`,
    data_sources_affected: count || 0,
  });
}
