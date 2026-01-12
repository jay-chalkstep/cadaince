/**
 * GET /api/integrations-v2/data-sources - List all data sources
 * POST /api/integrations-v2/data-sources - Create a new data source
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { DataSourceCreateInput } from "@/lib/integrations/oauth";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const integrationId = searchParams.get("integration_id");

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

  // Build query
  let query = supabase
    .from("data_sources_v2")
    .select(
      `
      id,
      name,
      description,
      source_type,
      query_config,
      destination_type,
      destination_config,
      sync_frequency,
      is_active,
      last_sync_at,
      last_sync_status,
      last_sync_error,
      last_sync_records_count,
      next_scheduled_sync_at,
      created_at,
      updated_at,
      integration:integrations_v2!inner(
        id,
        provider,
        display_name,
        status
      )
    `
    )
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false });

  if (integrationId) {
    query = query.eq("integration_id", integrationId);
  }

  const { data: dataSources, error } = await query;

  if (error) {
    console.error("Error fetching data sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch data sources" },
      { status: 500 }
    );
  }

  return NextResponse.json(dataSources || []);
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
  let body: DataSourceCreateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.integration_id || !body.name || !body.source_type) {
    return NextResponse.json(
      { error: "integration_id, name, and source_type are required" },
      { status: 400 }
    );
  }

  // Verify integration belongs to this org and is active
  const { data: integration, error: integrationError } = await supabase
    .from("integrations_v2")
    .select("id, status")
    .eq("id", body.integration_id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (integrationError || !integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  if (integration.status !== "active") {
    return NextResponse.json(
      { error: "Integration is not active" },
      { status: 400 }
    );
  }

  // Create data source
  const { data: dataSource, error: insertError } = await supabase
    .from("data_sources_v2")
    .insert({
      organization_id: profile.organization_id,
      integration_id: body.integration_id,
      name: body.name,
      description: body.description || null,
      source_type: body.source_type,
      query_config: body.query_config || {},
      destination_type: body.destination_type || "signal",
      destination_config: body.destination_config || {},
      sync_frequency: body.sync_frequency || "hourly",
      created_by: profile.id,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error creating data source:", insertError);
    return NextResponse.json(
      { error: "Failed to create data source" },
      { status: 500 }
    );
  }

  return NextResponse.json(dataSource, { status: 201 });
}
