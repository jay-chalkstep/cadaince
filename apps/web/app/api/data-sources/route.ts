import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/data-sources - List all data sources
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get all data sources with creator info and metric count
  const { data: dataSources, error } = await supabase
    .from("data_sources")
    .select(`
      *,
      created_by_profile:profiles!data_sources_created_by_fkey(id, full_name, avatar_url)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching data sources:", error);
    return NextResponse.json({ error: "Failed to fetch data sources" }, { status: 500 });
  }

  // Get metric count for each data source
  const dataSourcesWithCounts = await Promise.all(
    (dataSources || []).map(async (ds) => {
      const { count } = await supabase
        .from("metrics")
        .select("*", { count: "exact", head: true })
        .eq("data_source_id", ds.id);

      return {
        ...ds,
        metrics_count: count || 0,
      };
    })
  );

  return NextResponse.json(dataSourcesWithCounts);
}

// POST /api/data-sources - Create a new data source (admin only)
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level")
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

  // Validation
  if (!name) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  if (!source_type || !["hubspot", "bigquery"].includes(source_type)) {
    return NextResponse.json(
      { error: "source_type must be 'hubspot' or 'bigquery'" },
      { status: 400 }
    );
  }

  // Validate HubSpot-specific fields
  if (source_type === "hubspot") {
    if (!hubspot_object) {
      return NextResponse.json(
        { error: "hubspot_object is required for HubSpot data sources" },
        { status: 400 }
      );
    }
    if (!hubspot_property) {
      return NextResponse.json(
        { error: "hubspot_property is required for HubSpot data sources" },
        { status: 400 }
      );
    }
    if (!hubspot_aggregation) {
      return NextResponse.json(
        { error: "hubspot_aggregation is required for HubSpot data sources" },
        { status: 400 }
      );
    }
  }

  // Validate BigQuery-specific fields
  if (source_type === "bigquery") {
    if (!bigquery_query) {
      return NextResponse.json(
        { error: "bigquery_query is required for BigQuery data sources" },
        { status: 400 }
      );
    }
    if (!bigquery_value_column) {
      return NextResponse.json(
        { error: "bigquery_value_column is required for BigQuery data sources" },
        { status: 400 }
      );
    }
    // Check for required placeholders
    if (!bigquery_query.includes("{{start}}") || !bigquery_query.includes("{{end}}")) {
      return NextResponse.json(
        { error: "BigQuery query must include {{start}} and {{end}} placeholders" },
        { status: 400 }
      );
    }
  }

  const { data: dataSource, error } = await supabase
    .from("data_sources")
    .insert({
      name,
      description,
      source_type,
      hubspot_object: source_type === "hubspot" ? hubspot_object : null,
      hubspot_property: source_type === "hubspot" ? hubspot_property : null,
      hubspot_aggregation: source_type === "hubspot" ? hubspot_aggregation : null,
      hubspot_filters: source_type === "hubspot" ? (hubspot_filters || []) : null,
      bigquery_query: source_type === "bigquery" ? bigquery_query : null,
      bigquery_value_column: source_type === "bigquery" ? bigquery_value_column : null,
      unit,
      created_by: profile.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating data source:", error);
    return NextResponse.json({ error: "Failed to create data source" }, { status: 500 });
  }

  return NextResponse.json(dataSource, { status: 201 });
}
