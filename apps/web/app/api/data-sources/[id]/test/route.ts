import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { hubspotClient } from "@/lib/integrations/hubspot/client";
import { bigqueryClient } from "@/lib/integrations/bigquery/client";
import {
  getTimeRange,
  formatDateISO,
  getTimeWindowLabel,
  type TimeWindow,
} from "@/lib/integrations/sync/time-windows";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/data-sources/[id]/test - Test a data source with a sample time window
export async function POST(req: Request, { params }: RouteParams) {
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

  // Get request body
  const body = await req.json().catch(() => ({}));
  const testWindow: TimeWindow = body.time_window || "week";

  // Validate time window
  const validWindows = ["day", "week", "mtd", "qtd", "ytd", "trailing_7", "trailing_30", "trailing_90"];
  if (!validWindows.includes(testWindow)) {
    return NextResponse.json(
      { error: `Invalid time_window. Must be one of: ${validWindows.join(", ")}` },
      { status: 400 }
    );
  }

  // Get data source
  const { data: dataSource, error } = await supabase
    .from("data_sources")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !dataSource) {
    return NextResponse.json({ error: "Data source not found" }, { status: 404 });
  }

  // Get time range for the test window
  const { start, end } = getTimeRange(testWindow);

  try {
    let result: { success: boolean; value?: number; error?: string; records_processed?: number; details?: Record<string, unknown> };

    if (dataSource.source_type === "hubspot") {
      // Check if HubSpot is configured
      if (!hubspotClient.isConfigured()) {
        return NextResponse.json({
          success: false,
          error: "HubSpot integration not configured. Set HUBSPOT_ACCESS_TOKEN environment variable.",
        });
      }

      // Test HubSpot data source
      result = await hubspotClient.fetchMetric({
        object: dataSource.hubspot_object,
        property: dataSource.hubspot_property,
        aggregation: dataSource.hubspot_aggregation,
        filters: dataSource.hubspot_filters || undefined,
        date_range: "custom",
        custom_date_field: "createdate", // Default date field
      });
    } else if (dataSource.source_type === "bigquery") {
      // Check if BigQuery is configured
      if (!bigqueryClient.isConfigured()) {
        return NextResponse.json({
          success: false,
          error: "BigQuery integration not configured. Set BIGQUERY_PROJECT_ID and BIGQUERY_CREDENTIALS environment variables.",
        });
      }

      // Replace time placeholders in query
      const processedQuery = dataSource.bigquery_query
        .replace(/\{\{start\}\}/g, formatDateISO(start))
        .replace(/\{\{end\}\}/g, formatDateISO(end));

      // Test BigQuery data source
      result = await bigqueryClient.fetchMetric({
        query: processedQuery,
        value_column: dataSource.bigquery_value_column,
      });
    } else {
      return NextResponse.json(
        { error: `Unsupported source type: ${dataSource.source_type}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: result.success,
      data_source: {
        id: dataSource.id,
        name: dataSource.name,
        source_type: dataSource.source_type,
      },
      test_window: {
        window: testWindow,
        label: getTimeWindowLabel(testWindow),
        start: formatDateISO(start),
        end: formatDateISO(end),
      },
      result: {
        value: result.value,
        formatted_value: result.value !== undefined
          ? formatValue(result.value, dataSource.unit)
          : null,
        records_processed: result.records_processed,
        error: result.error,
        details: result.details,
      },
    });
  } catch (error) {
    console.error("Error testing data source:", error);
    return NextResponse.json({
      success: false,
      data_source: {
        id: dataSource.id,
        name: dataSource.name,
        source_type: dataSource.source_type,
      },
      test_window: {
        window: testWindow,
        label: getTimeWindowLabel(testWindow),
        start: formatDateISO(start),
        end: formatDateISO(end),
      },
      result: {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
    });
  }
}

/**
 * Format a value with its unit
 */
function formatValue(value: number, unit?: string): string {
  if (unit === "$") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (unit === "%") {
    return `${value.toFixed(1)}%`;
  }
  // Default number formatting
  return new Intl.NumberFormat("en-US").format(value);
}
