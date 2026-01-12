/**
 * GET /api/integrations-v2 - List all integrations for the organization
 * POST /api/integrations-v2 - Create a service account integration (e.g., BigQuery)
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { encryptToken } from "@/lib/integrations/token-encryption";
import type { IntegrationListItem, IntegrationCreateInput } from "@/lib/integrations/oauth";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile and organization
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

  // Fetch all integrations for the organization
  const { data: integrations, error } = await supabase
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
      last_successful_connection_at,
      last_error,
      last_error_at,
      config,
      created_at
    `
    )
    .eq("organization_id", profile.organization_id)
    .order("provider");

  if (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }

  // Get data source counts per integration
  const integrationIds = integrations?.map((i) => i.id) || [];
  let dataSourceCounts: Record<string, number> = {};

  if (integrationIds.length > 0) {
    const { data: counts } = await supabase
      .from("data_sources_v2")
      .select("integration_id")
      .in("integration_id", integrationIds);

    if (counts) {
      dataSourceCounts = counts.reduce(
        (acc, row) => {
          acc[row.integration_id] = (acc[row.integration_id] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
    }
  }

  // Add data source counts to integrations
  const integrationsWithCounts: IntegrationListItem[] = (integrations || []).map(
    (integration) => ({
      ...integration,
      data_source_count: dataSourceCounts[integration.id] || 0,
    })
  );

  return NextResponse.json(integrationsWithCounts);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  // Parse request body
  let body: IntegrationCreateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate provider
  const validProviders = [
    "slack",
    "hubspot",
    "salesforce",
    "gong",
    "salesloft",
    "bigquery",
  ];
  if (!body.provider || !validProviders.includes(body.provider)) {
    return NextResponse.json(
      { error: "Invalid provider" },
      { status: 400 }
    );
  }

  // For OAuth providers, this endpoint shouldn't be used directly
  // They should use the OAuth flow instead
  if (body.provider !== "bigquery") {
    return NextResponse.json(
      {
        error: "Use OAuth flow for this provider. POST to /api/integrations-v2/{provider}/oauth/connect",
      },
      { status: 400 }
    );
  }

  // BigQuery requires service account JSON
  if (!body.service_account_json) {
    return NextResponse.json(
      { error: "Service account JSON is required for BigQuery" },
      { status: 400 }
    );
  }

  // Validate service account JSON
  let serviceAccount: { project_id?: string; client_email?: string };
  try {
    serviceAccount = JSON.parse(body.service_account_json);
    if (!serviceAccount.project_id || !serviceAccount.client_email) {
      throw new Error("Invalid service account");
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid service account JSON" },
      { status: 400 }
    );
  }

  // Check if integration already exists
  const { data: existing } = await supabase
    .from("integrations_v2")
    .select("id, status")
    .eq("organization_id", profile.organization_id)
    .eq("provider", body.provider)
    .single();

  if (existing) {
    // Update existing integration
    const { data: updated, error: updateError } = await supabase
      .from("integrations_v2")
      .update({
        display_name: body.display_name || `BigQuery - ${serviceAccount.project_id}`,
        service_account_json_encrypted: encryptToken(body.service_account_json),
        external_account_id: serviceAccount.project_id,
        external_account_name: serviceAccount.client_email,
        status: "active",
        status_message: null,
        last_successful_connection_at: new Date().toISOString(),
        last_error: null,
        last_error_at: null,
        config: body.config || {},
      })
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

  // Create new integration
  const { data: integration, error: insertError } = await supabase
    .from("integrations_v2")
    .insert({
      organization_id: profile.organization_id,
      provider: body.provider,
      display_name: body.display_name || `BigQuery - ${serviceAccount.project_id}`,
      service_account_json_encrypted: encryptToken(body.service_account_json),
      external_account_id: serviceAccount.project_id,
      external_account_name: serviceAccount.client_email,
      status: "active",
      connected_by_profile_id: profile.id,
      last_successful_connection_at: new Date().toISOString(),
      config: body.config || {},
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error creating integration:", insertError);
    return NextResponse.json(
      { error: "Failed to create integration" },
      { status: 500 }
    );
  }

  return NextResponse.json(integration, { status: 201 });
}
