/**
 * GET /api/integrations-v2/data-sources/[id] - Get a data source
 * PATCH /api/integrations-v2/data-sources/[id] - Update a data source
 * DELETE /api/integrations-v2/data-sources/[id] - Delete a data source
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Fetch data source
  const { data: dataSource, error } = await supabase
    .from("data_sources_v2")
    .select(
      `
      *,
      integration:integrations_v2(
        id,
        provider,
        display_name,
        status
      )
    `
    )
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 }
      );
    }
    console.error("Error fetching data source:", error);
    return NextResponse.json(
      { error: "Failed to fetch data source" },
      { status: 500 }
    );
  }

  return NextResponse.json(dataSource);
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  let body: Partial<{
    name: string;
    description: string | null;
    source_type: string;
    query_config: Record<string, unknown>;
    destination_type: string;
    destination_config: Record<string, unknown>;
    sync_frequency: string;
    is_active: boolean;
  }>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Verify data source exists and belongs to org
  const { data: existing, error: findError } = await supabase
    .from("data_sources_v2")
    .select("id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (findError || !existing) {
    return NextResponse.json(
      { error: "Data source not found" },
      { status: 404 }
    );
  }

  // Build update data (only include defined fields)
  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    "name",
    "description",
    "source_type",
    "query_config",
    "destination_type",
    "destination_config",
    "sync_frequency",
    "is_active",
  ];

  for (const field of allowedFields) {
    if (body[field as keyof typeof body] !== undefined) {
      updateData[field] = body[field as keyof typeof body];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  // Update data source
  const { data: updated, error: updateError } = await supabase
    .from("data_sources_v2")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    console.error("Error updating data source:", updateError);
    return NextResponse.json(
      { error: "Failed to update data source" },
      { status: 500 }
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Verify data source exists and belongs to org
  const { data: existing, error: findError } = await supabase
    .from("data_sources_v2")
    .select("id, name")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (findError || !existing) {
    return NextResponse.json(
      { error: "Data source not found" },
      { status: 404 }
    );
  }

  // Delete data source (cascades to syncs and signals)
  const { error: deleteError } = await supabase
    .from("data_sources_v2")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Error deleting data source:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete data source" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Data source "${existing.name}" deleted`,
  });
}
