import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/integrations/[id]/sync - Trigger a manual sync for an integration
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Get the integration
  const { data: integration, error: integrationError } = await supabase
    .from("integrations")
    .select("*")
    .eq("id", id)
    .single();

  if (integrationError || !integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  if (!integration.is_active) {
    return NextResponse.json({ error: "Integration is not active" }, { status: 400 });
  }

  if (!integration.credentials_set) {
    return NextResponse.json({ error: "Integration credentials not configured" }, { status: 400 });
  }

  // Parse optional body for metric_id
  let metricId: string | null = null;
  try {
    const body = await req.json();
    metricId = body.metric_id || null;
  } catch {
    // No body provided, sync all metrics for this integration
  }

  try {
    // Create a sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from("sync_logs")
      .insert({
        integration_id: id,
        metric_id: metricId,
        status: "running",
      })
      .select()
      .single();

    if (logError) {
      console.error("Error creating sync log:", logError);
      return NextResponse.json({ error: "Failed to start sync" }, { status: 500 });
    }

    // Perform the sync based on integration type
    let syncResult: SyncResult;

    switch (integration.type) {
      case "hubspot":
        syncResult = await syncHubSpotMetrics(supabase, integration, metricId);
        break;
      case "bigquery":
        syncResult = await syncBigQueryMetrics(supabase, integration, metricId);
        break;
      default:
        syncResult = { success: false, message: `Unsupported integration type: ${integration.type}`, recordsProcessed: 0 };
    }

    // Update the sync log with results
    await supabase
      .from("sync_logs")
      .update({
        completed_at: new Date().toISOString(),
        status: syncResult.success ? "success" : "error",
        records_processed: syncResult.recordsProcessed,
        error_message: syncResult.success ? null : syncResult.message,
        details: syncResult.details || null,
      })
      .eq("id", syncLog.id);

    // Update integration last_sync_at if successful
    if (syncResult.success) {
      await supabase
        .from("integrations")
        .update({
          last_sync_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", id);
    } else {
      await supabase
        .from("integrations")
        .update({ last_error: syncResult.message })
        .eq("id", id);
    }

    return NextResponse.json({
      success: syncResult.success,
      message: syncResult.message,
      sync_log_id: syncLog.id,
      records_processed: syncResult.recordsProcessed,
    });
  } catch (error) {
    console.error("Error during sync:", error);
    return NextResponse.json({
      success: false,
      message: "Sync failed with unexpected error",
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

interface SyncResult {
  success: boolean;
  message: string;
  recordsProcessed: number;
  details?: Record<string, unknown>;
}

interface Integration {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

type SupabaseClient = ReturnType<typeof createAdminClient>;

async function syncHubSpotMetrics(
  supabase: SupabaseClient,
  integration: Integration,
  metricId: string | null
): Promise<SyncResult> {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!accessToken) {
    return {
      success: false,
      message: "HubSpot access token not configured",
      recordsProcessed: 0,
    };
  }

  // Get metrics configured with HubSpot source
  let metricsQuery = supabase
    .from("metrics")
    .select("*")
    .eq("source_type", "hubspot")
    .eq("sync_enabled", true);

  if (metricId) {
    metricsQuery = metricsQuery.eq("id", metricId);
  }

  const { data: metrics, error: metricsError } = await metricsQuery;

  if (metricsError) {
    return {
      success: false,
      message: "Failed to fetch metrics",
      recordsProcessed: 0,
    };
  }

  if (!metrics || metrics.length === 0) {
    return {
      success: true,
      message: "No HubSpot metrics configured for sync",
      recordsProcessed: 0,
    };
  }

  let processedCount = 0;
  const errors: string[] = [];

  for (const metric of metrics) {
    try {
      const sourceConfig = metric.source_config as {
        hubspot_object?: string;
        hubspot_property?: string;
        hubspot_aggregation?: string;
        hubspot_filters?: Record<string, unknown>;
      } | null;

      if (!sourceConfig?.hubspot_object) {
        errors.push(`Metric ${metric.name}: No HubSpot object configured`);
        continue;
      }

      const value = await fetchHubSpotMetricValue(
        accessToken,
        sourceConfig.hubspot_object,
        sourceConfig.hubspot_property,
        sourceConfig.hubspot_aggregation || "count",
        sourceConfig.hubspot_filters
      );

      if (value !== null) {
        // Insert new metric value
        await supabase
          .from("metric_values")
          .insert({
            metric_id: metric.id,
            value,
            source: "hubspot",
            notes: `Synced from HubSpot (${sourceConfig.hubspot_object})`,
          });

        // Update metric sync timestamp
        await supabase
          .from("metrics")
          .update({
            last_sync_at: new Date().toISOString(),
            sync_error: null,
          })
          .eq("id", metric.id);

        processedCount++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Metric ${metric.name}: ${errorMessage}`);

      // Update metric with sync error
      await supabase
        .from("metrics")
        .update({ sync_error: errorMessage })
        .eq("id", metric.id);
    }
  }

  return {
    success: errors.length === 0,
    message: errors.length > 0
      ? `Synced ${processedCount} metrics with ${errors.length} errors`
      : `Successfully synced ${processedCount} metrics`,
    recordsProcessed: processedCount,
    details: errors.length > 0 ? { errors } : undefined,
  };
}

async function fetchHubSpotMetricValue(
  accessToken: string,
  objectType: string,
  property: string | undefined,
  aggregation: string,
  filters?: Record<string, unknown>
): Promise<number | null> {
  // Map object types to HubSpot API endpoints
  const objectEndpoints: Record<string, string> = {
    deals: "crm/v3/objects/deals",
    contacts: "crm/v3/objects/contacts",
    tickets: "crm/v3/objects/tickets",
    feedback_submissions: "crm/v3/objects/feedback_submissions",
  };

  const endpoint = objectEndpoints[objectType];
  if (!endpoint) {
    throw new Error(`Unsupported HubSpot object type: ${objectType}`);
  }

  // Build search request for aggregation
  const searchEndpoint = `https://api.hubapi.com/crm/v3/objects/${objectType}/search`;

  const searchBody: Record<string, unknown> = {
    filterGroups: filters ? [{ filters: Object.entries(filters).map(([key, value]) => ({
      propertyName: key,
      operator: "EQ",
      value,
    }))}] : [],
    limit: aggregation === "count" ? 0 : 100,
  };

  if (property && aggregation !== "count") {
    searchBody.properties = [property];
  }

  const response = await fetch(searchEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(searchBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`HubSpot API error: ${errorData.message || response.statusText}`);
  }

  const data = await response.json();

  // Calculate value based on aggregation type
  switch (aggregation) {
    case "count":
      return data.total || 0;
    case "sum":
    case "avg":
    case "min":
    case "max":
      if (!property || !data.results) return null;
      const values = data.results
        .map((r: { properties: Record<string, string> }) => parseFloat(r.properties[property]))
        .filter((v: number) => !isNaN(v));

      if (values.length === 0) return null;

      switch (aggregation) {
        case "sum":
          return values.reduce((a: number, b: number) => a + b, 0);
        case "avg":
          return values.reduce((a: number, b: number) => a + b, 0) / values.length;
        case "min":
          return Math.min(...values);
        case "max":
          return Math.max(...values);
      }
      return null;
    default:
      return null;
  }
}

async function syncBigQueryMetrics(
  supabase: SupabaseClient,
  integration: Integration,
  metricId: string | null
): Promise<SyncResult> {
  const serviceAccountKey = process.env.BIGQUERY_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    return {
      success: false,
      message: "BigQuery service account key not configured",
      recordsProcessed: 0,
    };
  }

  // Get metrics configured with BigQuery source
  let metricsQuery = supabase
    .from("metrics")
    .select("*")
    .eq("source_type", "bigquery")
    .eq("sync_enabled", true);

  if (metricId) {
    metricsQuery = metricsQuery.eq("id", metricId);
  }

  const { data: metrics, error: metricsError } = await metricsQuery;

  if (metricsError) {
    return {
      success: false,
      message: "Failed to fetch metrics",
      recordsProcessed: 0,
    };
  }

  if (!metrics || metrics.length === 0) {
    return {
      success: true,
      message: "No BigQuery metrics configured for sync",
      recordsProcessed: 0,
    };
  }

  // In production, you would use the BigQuery client library here
  // For now, return a placeholder response
  return {
    success: true,
    message: `BigQuery sync configured for ${metrics.length} metrics (requires BigQuery client library)`,
    recordsProcessed: 0,
    details: {
      note: "BigQuery integration requires @google-cloud/bigquery package",
      configured_metrics: metrics.map(m => m.name),
    },
  };
}
