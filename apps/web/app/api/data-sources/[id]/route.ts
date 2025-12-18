import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/data-sources/[id] - Get a single data source
export async function GET(req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: dataSource, error } = await supabase
    .from("data_sources")
    .select(`
      *,
      created_by_profile:profiles!data_sources_created_by_fkey(id, full_name, avatar_url)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Data source not found" }, { status: 404 });
    }
    console.error("Error fetching data source:", error);
    return NextResponse.json({ error: "Failed to fetch data source" }, { status: 500 });
  }

  // Get metrics using this data source
  const { data: metrics } = await supabase
    .from("metrics")
    .select("id, name, metric_type, time_windows, last_sync_at, sync_error")
    .eq("data_source_id", id);

  return NextResponse.json({
    ...dataSource,
    metrics: metrics || [],
  });
}

// PUT /api/data-sources/[id] - Update a data source (admin only)
export async function PUT(req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name,
    description,
    source_type,
    hubspot_object,
    hubspot_property,
    hubspot_aggregation,
    hubspot_filters,
    bigquery_query,
    bigquery_value_column,
    unit,
  } = body;

  // Check if data source exists
  const { data: existingSource } = await supabase
    .from("data_sources")
    .select("id, source_type")
    .eq("id", id)
    .single();

  if (!existingSource) {
    return NextResponse.json({ error: "Data source not found" }, { status: 404 });
  }

  // Build update object
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (unit !== undefined) updateData.unit = unit;

  // Handle source type changes
  const effectiveSourceType = source_type || existingSource.source_type;
  if (source_type !== undefined) updateData.source_type = source_type;

  // Update source-specific fields
  if (effectiveSourceType === "hubspot") {
    if (hubspot_object !== undefined) updateData.hubspot_object = hubspot_object;
    if (hubspot_property !== undefined) updateData.hubspot_property = hubspot_property;
    if (hubspot_aggregation !== undefined) updateData.hubspot_aggregation = hubspot_aggregation;
    if (hubspot_filters !== undefined) updateData.hubspot_filters = hubspot_filters;
    // Clear BigQuery fields if switching to HubSpot
    if (source_type === "hubspot" && existingSource.source_type !== "hubspot") {
      updateData.bigquery_query = null;
      updateData.bigquery_value_column = null;
    }
  } else if (effectiveSourceType === "bigquery") {
    if (bigquery_query !== undefined) {
      // Validate placeholders
      if (!bigquery_query.includes("{{start}}") || !bigquery_query.includes("{{end}}")) {
        return NextResponse.json(
          { error: "BigQuery query must include {{start}} and {{end}} placeholders" },
          { status: 400 }
        );
      }
      updateData.bigquery_query = bigquery_query;
    }
    if (bigquery_value_column !== undefined) updateData.bigquery_value_column = bigquery_value_column;
    // Clear HubSpot fields if switching to BigQuery
    if (source_type === "bigquery" && existingSource.source_type !== "bigquery") {
      updateData.hubspot_object = null;
      updateData.hubspot_property = null;
      updateData.hubspot_aggregation = null;
      updateData.hubspot_filters = null;
    }
  }

  const { data: dataSource, error } = await supabase
    .from("data_sources")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating data source:", error);
    return NextResponse.json({ error: "Failed to update data source" }, { status: 500 });
  }

  return NextResponse.json(dataSource);
}

// DELETE /api/data-sources/[id] - Delete a data source (admin only)
export async function DELETE(req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  // Check if any metrics are using this data source
  const { count } = await supabase
    .from("metrics")
    .select("*", { count: "exact", head: true })
    .eq("data_source_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} metric(s) are using this data source` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("data_sources")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting data source:", error);
    return NextResponse.json({ error: "Failed to delete data source" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
