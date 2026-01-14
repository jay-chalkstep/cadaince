/**
 * HubSpot Deal Sync for Growth Pulse
 *
 * Fetches deals from HubSpot and stores them in the hubspot_deals table.
 * Tracks stage changes in hubspot_deal_stage_history for velocity analytics.
 */

import { HubSpotClient } from "../providers/hubspot/client";
import { createAdminClient } from "@/lib/supabase/server";

// Properties to fetch from HubSpot
const DEAL_PROPERTIES = [
  // Core identifiers
  "hs_object_id",
  "dealname",

  // Pipeline & Stage
  "dealstage",
  "pipeline",
  "hs_deal_stage_probability",
  "hs_forecast_amount",
  "hs_forecast_category",

  // Financial - Standard
  "amount",
  "hs_arr",

  // Financial - Custom (Fees & Revenue)
  "platform_fee",
  "setup_fee",
  "product_fee",
  "gpv_in_current_year",
  "gpv_full_year",
  "gp_in_current_year",
  "gp_full_year",

  // Classification - Standard
  "dealtype",
  "offering_type",
  "offering",

  // Classification - Custom
  "opportunity_type",
  "opportunity_description",
  "opportunity_sub_category",
  "channel_type",
  "solution",
  "sku",
  "integration_type",
  "buyer_type",
  "compelling_event",
  "pain_type",

  // Dates
  "closedate",
  "createdate",
  "hs_lastmodifieddate",
  "decision_date",
  "launch_date",

  // Owner
  "hubspot_owner_id",
];

export interface SyncDealsResult {
  success: boolean;
  recordsFetched?: number;
  recordsCreated?: number;
  recordsUpdated?: number;
  stageChangesDetected?: number;
  error?: string;
  syncLogId?: string;
}

interface ExistingDeal {
  id: string;
  hubspot_deal_id: string;
  deal_stage: string | null;
}

/**
 * Sync HubSpot deals to the hubspot_deals table
 */
export async function syncHubSpotDeals(
  organizationId: string
): Promise<SyncDealsResult> {
  const supabase = createAdminClient();
  let syncLogId: string | undefined;

  try {
    console.log("[syncHubSpotDeals] Starting sync for org:", organizationId);

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from("growth_pulse_sync_log")
      .insert({
        organization_id: organizationId,
        sync_type: "deals",
        status: "running",
      })
      .select("id")
      .single();

    if (syncLogError) {
      console.error("[syncHubSpotDeals] Failed to create sync log:", syncLogError);
    } else {
      syncLogId = syncLog.id;
    }

    // Get HubSpot client for this organization
    const client = await HubSpotClient.forOrganization(organizationId);
    if (!client) {
      const errorMsg = "No HubSpot integration found for this organization";
      await updateSyncLog(supabase, syncLogId, "error", errorMsg);
      return {
        success: false,
        error: errorMsg,
        syncLogId,
      };
    }

    console.log("[syncHubSpotDeals] Fetching deals from HubSpot...");

    // Fetch all deals from HubSpot with company associations
    const result = await client.fetchRawRecords(
      "deals",
      DEAL_PROPERTIES,
      undefined,
      ["companies"]
    );

    if (!result.success || !result.records) {
      const errorMsg = result.error || "Failed to fetch deals from HubSpot";
      await updateSyncLog(supabase, syncLogId, "error", errorMsg);
      return {
        success: false,
        error: errorMsg,
        syncLogId,
      };
    }

    console.log("[syncHubSpotDeals] Fetched deals:", result.records.length);

    // Get existing deals for stage change detection
    const { data: existingDeals } = await supabase
      .from("hubspot_deals")
      .select("id, hubspot_deal_id, deal_stage")
      .eq("organization_id", organizationId);

    const existingDealMap = new Map<string, ExistingDeal>(
      (existingDeals || []).map((d) => [d.hubspot_deal_id, d])
    );

    // Fetch company names for associations
    const companyIds = new Set<string>();
    for (const record of result.records) {
      const companyId = record.properties.associated_companies_id;
      if (companyId) {
        companyIds.add(companyId);
      }
    }

    const companyNameMap = await fetchCompanyNames(client, Array.from(companyIds));

    // Prepare deal records for upsert
    const now = new Date().toISOString();
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let stageChangesDetected = 0;

    const dealRecords = result.records.map((record) => {
      const props = record.properties;
      const companyId = props.associated_companies_id || null;

      return {
        organization_id: organizationId,
        hubspot_deal_id: record.id,
        deal_name: props.dealname || null,
        amount: parseNumeric(props.amount),
        hs_arr: parseNumeric(props.hs_arr),
        deal_stage: props.dealstage || null,
        pipeline: props.pipeline || null,
        deal_type: props.dealtype || null,
        offering: props.offering || props.offering_type || null,
        close_date: parseDate(props.closedate),
        create_date: parseDate(props.createdate),
        owner_id: props.hubspot_owner_id || null,
        company_id: companyId,
        company_name: companyId ? companyNameMap.get(companyId) || null : null,
        deal_stage_probability: parseNumeric(props.hs_deal_stage_probability),
        forecast_amount: parseNumeric(props.hs_forecast_amount),
        forecast_category: props.hs_forecast_category || null,
        properties: props,
        synced_at: now,
        external_created_at: parseDate(props.createdate),
        external_updated_at: parseDate(props.hs_lastmodifieddate),
      };
    });

    // Upsert deals in batches
    const batchSize = 100;
    for (let i = 0; i < dealRecords.length; i += batchSize) {
      const batch = dealRecords.slice(i, i + batchSize);

      const { error } = await supabase
        .from("hubspot_deals")
        .upsert(batch, {
          onConflict: "organization_id,hubspot_deal_id",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("[syncHubSpotDeals] Failed to upsert deals:", error);
        throw new Error(`Failed to save deals: ${error.message}`);
      }
    }

    // Track stage changes
    // First, get all deals again to get their UUIDs
    const { data: updatedDeals } = await supabase
      .from("hubspot_deals")
      .select("id, hubspot_deal_id, deal_stage, amount, hs_arr")
      .eq("organization_id", organizationId);

    const updatedDealMap = new Map(
      (updatedDeals || []).map((d) => [d.hubspot_deal_id, d])
    );

    // Detect stage changes and create history records
    const stageHistoryRecords: Array<{
      organization_id: string;
      deal_id: string;
      hubspot_deal_id: string;
      from_stage: string | null;
      to_stage: string;
      entered_at: string;
      deal_amount: number | null;
      deal_arr: number | null;
    }> = [];

    for (const record of result.records) {
      const hubspotDealId = record.id;
      const newStage = record.properties.dealstage;
      const existingDeal = existingDealMap.get(hubspotDealId);
      const updatedDeal = updatedDealMap.get(hubspotDealId);

      if (!updatedDeal) continue;

      if (!existingDeal) {
        // New deal - create initial history record
        if (newStage) {
          stageHistoryRecords.push({
            organization_id: organizationId,
            deal_id: updatedDeal.id,
            hubspot_deal_id: hubspotDealId,
            from_stage: null,
            to_stage: newStage,
            entered_at: now,
            deal_amount: updatedDeal.amount,
            deal_arr: updatedDeal.hs_arr,
          });
        }
        recordsCreated++;
      } else {
        // Existing deal - check for stage change
        recordsUpdated++;

        if (newStage && existingDeal.deal_stage !== newStage) {
          stageChangesDetected++;

          // Close the previous stage history record
          await supabase
            .from("hubspot_deal_stage_history")
            .update({
              exited_at: now,
              duration_ms: null, // Will be computed in the view/query
            })
            .eq("deal_id", updatedDeal.id)
            .is("exited_at", null);

          // Create new stage history record
          stageHistoryRecords.push({
            organization_id: organizationId,
            deal_id: updatedDeal.id,
            hubspot_deal_id: hubspotDealId,
            from_stage: existingDeal.deal_stage,
            to_stage: newStage,
            entered_at: now,
            deal_amount: updatedDeal.amount,
            deal_arr: updatedDeal.hs_arr,
          });
        }
      }
    }

    // Insert stage history records
    if (stageHistoryRecords.length > 0) {
      const { error: historyError } = await supabase
        .from("hubspot_deal_stage_history")
        .insert(stageHistoryRecords);

      if (historyError) {
        console.error("[syncHubSpotDeals] Failed to insert stage history:", historyError);
        // Don't fail the whole sync for history errors
      }
    }

    console.log("[syncHubSpotDeals] Sync complete:", {
      recordsFetched: result.records.length,
      recordsCreated,
      recordsUpdated,
      stageChangesDetected,
    });

    // Update sync log
    await updateSyncLog(supabase, syncLogId, "success", undefined, {
      records_fetched: result.records.length,
      records_created: recordsCreated,
      records_updated: recordsUpdated,
      stage_changes_detected: stageChangesDetected,
    });

    return {
      success: true,
      recordsFetched: result.records.length,
      recordsCreated,
      recordsUpdated,
      stageChangesDetected,
      syncLogId,
    };
  } catch (error) {
    console.error("[syncHubSpotDeals] Error:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await updateSyncLog(supabase, syncLogId, "error", errorMsg);
    return {
      success: false,
      error: errorMsg,
      syncLogId,
    };
  }
}

/**
 * Fetch company names for a list of company IDs
 */
async function fetchCompanyNames(
  client: HubSpotClient,
  companyIds: string[]
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();

  if (companyIds.length === 0) {
    return nameMap;
  }

  try {
    // Fetch companies in batches
    const batchSize = 100;
    for (let i = 0; i < companyIds.length; i += batchSize) {
      const batchIds = companyIds.slice(i, i + batchSize);

      // Use search API with IN filter
      const result = await client.fetchRawRecords(
        "companies",
        ["name", "domain"],
        [{ propertyName: "hs_object_id", operator: "IN", value: batchIds }]
      );

      if (result.success && result.records) {
        for (const record of result.records) {
          const name = record.properties.name;
          if (name) {
            nameMap.set(record.id, name);
          }
        }
      }
    }
  } catch (error) {
    console.error("[fetchCompanyNames] Error:", error);
  }

  return nameMap;
}

/**
 * Update sync log with status and results
 */
async function updateSyncLog(
  supabase: ReturnType<typeof createAdminClient>,
  syncLogId: string | undefined,
  status: "success" | "error",
  errorMessage?: string,
  results?: {
    records_fetched?: number;
    records_created?: number;
    records_updated?: number;
    stage_changes_detected?: number;
  }
) {
  if (!syncLogId) return;

  await supabase
    .from("growth_pulse_sync_log")
    .update({
      status,
      completed_at: new Date().toISOString(),
      error_message: errorMessage || null,
      ...results,
    })
    .eq("id", syncLogId);
}

/**
 * Parse a string to a number, returning null if invalid
 */
function parseNumeric(value: string | null | undefined): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse a date string to ISO format, returning null if invalid
 */
function parseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
}
