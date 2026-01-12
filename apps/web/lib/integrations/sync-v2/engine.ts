/**
 * Sync Engine v2
 *
 * Processes data sources from integrations_v2 system.
 * Fetches data from providers and routes to destination processors.
 */

import { createAdminClient } from "@/lib/supabase/server";
import {
  HubSpotClient,
  type HubSpotQueryConfig,
  type HubSpotObject,
  type HubSpotRecord,
} from "../providers/hubspot";
import type {
  DataSource,
  DataSourceSync,
  SyncTrigger,
  DestinationType,
} from "../oauth/types";

export interface SyncResult {
  success: boolean;
  records_fetched: number;
  records_processed: number;
  signals_created: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface FetchResult {
  success: boolean;
  value?: number;
  records_fetched?: number;
  error?: string;
  raw_data?: unknown;
  // For raw record ingestion
  records?: HubSpotRecord[];
}

/**
 * Sync a single data source
 */
export async function syncDataSource(
  dataSourceId: string,
  trigger: SyncTrigger = "manual"
): Promise<SyncResult> {
  const supabase = createAdminClient();
  const startTime = Date.now();

  // Fetch the data source with integration
  const { data: dataSource, error: fetchError } = await supabase
    .from("data_sources_v2")
    .select(
      `
      *,
      integration:integrations_v2(
        id,
        organization_id,
        provider,
        status
      )
    `
    )
    .eq("id", dataSourceId)
    .single();

  if (fetchError || !dataSource) {
    return {
      success: false,
      records_fetched: 0,
      records_processed: 0,
      signals_created: 0,
      error: "Data source not found",
    };
  }

  const integration = dataSource.integration as {
    id: string;
    organization_id: string;
    provider: string;
    status: string;
  };

  if (!integration || integration.status !== "active") {
    return {
      success: false,
      records_fetched: 0,
      records_processed: 0,
      signals_created: 0,
      error: "Integration not active",
    };
  }

  // Create sync record
  const { data: syncRecord, error: syncCreateError } = await supabase
    .from("data_source_syncs")
    .insert({
      data_source_id: dataSourceId,
      organization_id: integration.organization_id,
      status: "running",
      triggered_by: trigger,
      records_fetched: 0,
      records_processed: 0,
      signals_created: 0,
    })
    .select()
    .single();

  if (syncCreateError) {
    console.error("[Sync] Failed to create sync record:", syncCreateError);
  }

  const syncId = syncRecord?.id;

  // Update data source status
  await supabase
    .from("data_sources_v2")
    .update({ last_sync_status: "running" })
    .eq("id", dataSourceId);

  try {
    // Fetch data from provider
    const fetchResult = await fetchFromProvider(
      integration.provider,
      integration.id,
      dataSource.source_type,
      dataSource.query_config as Record<string, unknown>
    );

    if (!fetchResult.success) {
      throw new Error(fetchResult.error || "Fetch failed");
    }

    // Process into destination
    const processResult = await processToDestination(
      dataSource as DataSource,
      fetchResult,
      integration.organization_id
    );

    const duration = Date.now() - startTime;

    // Update sync record
    if (syncId) {
      await supabase
        .from("data_source_syncs")
        .update({
          status: "success",
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          records_fetched: fetchResult.records_fetched || 0,
          records_processed: processResult.records_processed,
          signals_created: processResult.signals_created,
        })
        .eq("id", syncId);
    }

    // Update data source
    await supabase
      .from("data_sources_v2")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "success",
        last_sync_error: null,
        last_sync_records_count: fetchResult.records_fetched || 0,
      })
      .eq("id", dataSourceId);

    return {
      success: true,
      records_fetched: fetchResult.records_fetched || 0,
      records_processed: processResult.records_processed,
      signals_created: processResult.signals_created,
      details: {
        duration_ms: duration,
        value: fetchResult.value,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const duration = Date.now() - startTime;

    // Update sync record with error
    if (syncId) {
      await supabase
        .from("data_source_syncs")
        .update({
          status: "error",
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          error_message: errorMessage,
        })
        .eq("id", syncId);
    }

    // Update data source with error
    await supabase
      .from("data_sources_v2")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "error",
        last_sync_error: errorMessage,
      })
      .eq("id", dataSourceId);

    return {
      success: false,
      records_fetched: 0,
      records_processed: 0,
      signals_created: 0,
      error: errorMessage,
    };
  }
}

/**
 * Fetch data from a provider
 */
async function fetchFromProvider(
  provider: string,
  integrationId: string,
  sourceType: string,
  queryConfig: Record<string, unknown>
): Promise<FetchResult> {
  switch (provider) {
    case "hubspot":
      return fetchFromHubSpot(integrationId, sourceType, queryConfig);
    // case 'salesforce':
    //   return fetchFromSalesforce(integrationId, sourceType, queryConfig);
    // case 'gong':
    //   return fetchFromGong(integrationId, sourceType, queryConfig);
    default:
      return { success: false, error: `Provider ${provider} not supported` };
  }
}

/**
 * Fetch data from HubSpot
 */
async function fetchFromHubSpot(
  integrationId: string,
  sourceType: string,
  queryConfig: Record<string, unknown>
): Promise<FetchResult> {
  const client = await HubSpotClient.forIntegration(integrationId);
  if (!client) {
    return { success: false, error: "Failed to initialize HubSpot client" };
  }

  // Use sourceType as the object type if not specified in queryConfig
  const objectType = (queryConfig.object || sourceType) as HubSpotObject;

  // Check if this is a raw records fetch (has properties array)
  if (Array.isArray(queryConfig.properties)) {
    return fetchRawFromHubSpot(client, objectType, queryConfig);
  }

  // Legacy aggregation mode
  const config: HubSpotQueryConfig = {
    object: objectType,
    property: (queryConfig.property as string) || "id", // Default to counting by ID
    aggregation: (queryConfig.aggregation as HubSpotQueryConfig["aggregation"]) || "count",
    filters: queryConfig.filters as HubSpotQueryConfig["filters"],
    dateField: queryConfig.dateField as string,
    dateRange: queryConfig.dateRange as HubSpotQueryConfig["dateRange"],
  };

  const result = await client.fetch(config);

  return {
    success: result.success,
    value: result.value,
    records_fetched: result.records_fetched,
    error: result.error,
    raw_data: result.details,
  };
}

/**
 * Fetch raw records from HubSpot (for raw_records destination)
 */
async function fetchRawFromHubSpot(
  client: HubSpotClient,
  objectType: HubSpotObject,
  queryConfig: Record<string, unknown>
): Promise<FetchResult> {
  const properties = queryConfig.properties as string[];
  const filters = queryConfig.filters as HubSpotQueryConfig["filters"];

  const result = await client.fetchRawRecords(objectType, properties, filters);

  return {
    success: result.success,
    records_fetched: result.records_fetched,
    records: result.records,
    error: result.error,
  };
}

/**
 * Process fetched data to its destination
 */
async function processToDestination(
  dataSource: DataSource,
  fetchResult: FetchResult,
  organizationId: string
): Promise<{ records_processed: number; signals_created: number }> {
  const destinationType = dataSource.destination_type as DestinationType;

  switch (destinationType) {
    case "scorecard_metric":
      return processToScorecardMetric(
        dataSource,
        fetchResult,
        organizationId
      );
    case "signal":
      return processToSignal(dataSource, fetchResult, organizationId);
    case "issue_detection":
      return processToIssueDetection(dataSource, fetchResult, organizationId);
    case "raw_records":
      return processToRawRecords(dataSource, fetchResult, organizationId);
    default:
      // Default: just create a signal
      return processToSignal(dataSource, fetchResult, organizationId);
  }
}

/**
 * Process data to scorecard metric
 */
async function processToScorecardMetric(
  dataSource: DataSource,
  fetchResult: FetchResult,
  organizationId: string
): Promise<{ records_processed: number; signals_created: number }> {
  if (fetchResult.value === undefined) {
    return { records_processed: 0, signals_created: 0 };
  }

  const supabase = createAdminClient();
  const destinationConfig = dataSource.destination_config as {
    metric_id?: string;
    create_if_missing?: boolean;
    metric_name?: string;
    pillar_id?: string;
    owner_id?: string;
  };

  let metricId = destinationConfig.metric_id;

  // Create metric if configured and doesn't exist
  if (!metricId && destinationConfig.create_if_missing) {
    const { data: newMetric, error: createError } = await supabase
      .from("metrics")
      .insert({
        organization_id: organizationId,
        name: destinationConfig.metric_name || dataSource.name,
        source_type: "data_source",
        data_source_id: dataSource.id,
        sync_enabled: true,
        is_active: true,
        pillar_id: destinationConfig.pillar_id,
        owner_id: destinationConfig.owner_id,
      })
      .select()
      .single();

    if (createError) {
      console.error("[Sync] Failed to create metric:", createError);
      return { records_processed: 0, signals_created: 0 };
    }

    metricId = newMetric.id;

    // Update destination config with the new metric ID
    await supabase
      .from("data_sources_v2")
      .update({
        destination_config: { ...destinationConfig, metric_id: metricId },
      })
      .eq("id", dataSource.id);
  }

  if (!metricId) {
    console.error("[Sync] No metric ID configured for scorecard destination");
    return { records_processed: 0, signals_created: 0 };
  }

  // Record the metric value
  const { error: valueError } = await supabase.from("metric_values").insert({
    metric_id: metricId,
    value: fetchResult.value,
    source: "integration_sync",
    notes: `Auto-synced from ${dataSource.name}`,
  });

  if (valueError) {
    console.error("[Sync] Failed to record metric value:", valueError);
    return { records_processed: 0, signals_created: 0 };
  }

  // Update metric last_sync_at
  await supabase
    .from("metrics")
    .update({
      last_sync_at: new Date().toISOString(),
      sync_error: null,
    })
    .eq("id", metricId);

  return { records_processed: 1, signals_created: 0 };
}

/**
 * Process data to signal
 */
async function processToSignal(
  dataSource: DataSource,
  fetchResult: FetchResult,
  organizationId: string
): Promise<{ records_processed: number; signals_created: number }> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("signals").insert({
    organization_id: organizationId,
    data_source_id: dataSource.id,
    signal_type: dataSource.source_type,
    signal_category: "metric",
    title: dataSource.name,
    description: dataSource.description,
    value: fetchResult.value,
    metadata: {
      query_config: dataSource.query_config,
      raw_data: fetchResult.raw_data,
    },
    source_provider: "hubspot", // TODO: Get from integration
    severity: "info",
    occurred_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[Sync] Failed to create signal:", error);
    return { records_processed: 0, signals_created: 0 };
  }

  return { records_processed: 1, signals_created: 1 };
}

/**
 * Process data for issue detection
 */
async function processToIssueDetection(
  dataSource: DataSource,
  fetchResult: FetchResult,
  organizationId: string
): Promise<{ records_processed: number; signals_created: number }> {
  if (fetchResult.value === undefined) {
    return { records_processed: 0, signals_created: 0 };
  }

  const supabase = createAdminClient();
  const config = dataSource.destination_config as {
    threshold_type?: "above" | "below";
    threshold_value?: number;
    issue_title_template?: string;
    issue_pillar_id?: string;
  };

  // Check if threshold is violated
  const thresholdViolated =
    (config.threshold_type === "above" &&
      fetchResult.value > (config.threshold_value || 0)) ||
    (config.threshold_type === "below" &&
      fetchResult.value < (config.threshold_value || 0));

  if (!thresholdViolated) {
    return { records_processed: 1, signals_created: 0 };
  }

  // Create issue
  const issueTitle =
    config.issue_title_template?.replace("{value}", String(fetchResult.value)) ||
    `${dataSource.name}: ${fetchResult.value}`;

  const { error } = await supabase.from("issues").insert({
    organization_id: organizationId,
    title: issueTitle,
    description: `Automatically created from data source: ${dataSource.name}`,
    status: "open",
    priority: "high",
    issue_level: "pillar",
    pillar_id: config.issue_pillar_id,
  });

  if (error) {
    console.error("[Sync] Failed to create issue:", error);
    return { records_processed: 1, signals_created: 0 };
  }

  // Also create signal for audit trail
  await supabase.from("signals").insert({
    organization_id: organizationId,
    data_source_id: dataSource.id,
    signal_type: "threshold_breach",
    signal_category: "issue",
    title: issueTitle,
    value: fetchResult.value,
    metadata: {
      threshold_type: config.threshold_type,
      threshold_value: config.threshold_value,
    },
    source_provider: "hubspot",
    severity: "warning",
    occurred_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
    processed_into_type: "issue",
  });

  return { records_processed: 1, signals_created: 1 };
}

/**
 * Process data to raw records storage (integration_records table)
 */
async function processToRawRecords(
  dataSource: DataSource,
  fetchResult: FetchResult,
  organizationId: string
): Promise<{ records_processed: number; signals_created: number }> {
  const records = fetchResult.records;
  if (!records || records.length === 0) {
    return { records_processed: 0, signals_created: 0 };
  }

  const supabase = createAdminClient();
  const queryConfig = dataSource.query_config as { object?: string };
  const objectType = queryConfig.object || dataSource.source_type;

  let processed = 0;
  const batchSize = 100;

  // Process in batches for better performance
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const recordsToUpsert = batch.map((record) => ({
      organization_id: organizationId,
      data_source_id: dataSource.id,
      external_id: record.id,
      object_type: objectType,
      properties: record.properties,
      external_created_at: record.createdAt,
      external_updated_at: record.updatedAt,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("integration_records")
      .upsert(recordsToUpsert, {
        onConflict: "data_source_id,external_id",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error("[Sync] Failed to upsert records batch:", error);
      // Continue with next batch instead of failing entirely
    } else {
      processed += batch.length;
    }
  }

  // Auto-sync owners when tickets are synced (for Support Pulse name lookups)
  if (objectType === "tickets" && processed > 0) {
    try {
      const { syncHubSpotOwners } = await import("../hubspot/sync-owners");
      const ownerResult = await syncHubSpotOwners(organizationId);
      if (ownerResult.success) {
        console.log(`[Sync] Auto-synced ${ownerResult.count} HubSpot owners`);
      } else {
        console.warn("[Sync] Owner sync failed:", ownerResult.error);
      }
    } catch (ownerError) {
      console.warn("[Sync] Failed to auto-sync owners:", ownerError);
      // Don't fail the main sync if owner sync fails
    }
  }

  return { records_processed: processed, signals_created: 0 };
}

/**
 * Sync all active data sources for an organization
 */
export async function syncAllDataSources(
  organizationId: string,
  trigger: SyncTrigger = "scheduled"
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{ data_source_id: string; name: string; success: boolean; error?: string }>;
}> {
  const supabase = createAdminClient();

  const { data: dataSources, error } = await supabase
    .from("data_sources_v2")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error || !dataSources) {
    return { total: 0, succeeded: 0, failed: 0, results: [] };
  }

  const results: Array<{
    data_source_id: string;
    name: string;
    success: boolean;
    error?: string;
  }> = [];

  let succeeded = 0;
  let failed = 0;

  for (const ds of dataSources) {
    const result = await syncDataSource(ds.id, trigger);
    results.push({
      data_source_id: ds.id,
      name: ds.name,
      success: result.success,
      error: result.error,
    });

    if (result.success) succeeded++;
    else failed++;

    // Small delay between syncs to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return {
    total: dataSources.length,
    succeeded,
    failed,
    results,
  };
}
