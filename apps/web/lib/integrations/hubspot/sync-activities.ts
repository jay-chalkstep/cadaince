/**
 * HubSpot Activities Sync for Growth Pulse
 *
 * Fetches engagements (calls, emails, meetings, notes, tasks) from HubSpot
 * and stores them in the hubspot_activities table.
 */

import { HubSpotClient } from "../providers/hubspot/client";
import { createAdminClient } from "@/lib/supabase/server";

// Activity types to sync
const ACTIVITY_TYPES = ["calls", "emails", "meetings", "notes", "tasks"] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

// Properties to fetch for each activity type
const ACTIVITY_PROPERTIES: Record<ActivityType, string[]> = {
  calls: [
    "hs_object_id",
    "hs_call_title",
    "hs_call_body",
    "hs_timestamp",
    "hs_call_duration",
    "hubspot_owner_id",
    "hs_call_direction",
    "hs_call_status",
  ],
  emails: [
    "hs_object_id",
    "hs_email_subject",
    "hs_email_text",
    "hs_timestamp",
    "hubspot_owner_id",
    "hs_email_direction",
    "hs_email_status",
  ],
  meetings: [
    "hs_object_id",
    "hs_meeting_title",
    "hs_meeting_body",
    "hs_timestamp",
    "hs_meeting_start_time",
    "hs_meeting_end_time",
    "hubspot_owner_id",
    "hs_meeting_outcome",
  ],
  notes: [
    "hs_object_id",
    "hs_note_body",
    "hs_timestamp",
    "hubspot_owner_id",
  ],
  tasks: [
    "hs_object_id",
    "hs_task_subject",
    "hs_task_body",
    "hs_timestamp",
    "hubspot_owner_id",
    "hs_task_status",
    "hs_task_priority",
  ],
};

export interface SyncActivitiesResult {
  success: boolean;
  recordsFetched?: number;
  recordsCreated?: number;
  error?: string;
  syncLogId?: string;
  byType?: Record<string, number>;
}

/**
 * Sync HubSpot activities to the hubspot_activities table
 */
export async function syncHubSpotActivities(
  organizationId: string,
  activityTypes: ActivityType[] = [...ACTIVITY_TYPES]
): Promise<SyncActivitiesResult> {
  const supabase = createAdminClient();
  let syncLogId: string | undefined;

  try {
    console.log("[syncHubSpotActivities] Starting sync for org:", organizationId);

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from("growth_pulse_sync_log")
      .insert({
        organization_id: organizationId,
        sync_type: "activities",
        status: "running",
      })
      .select("id")
      .single();

    if (syncLogError) {
      console.error("[syncHubSpotActivities] Failed to create sync log:", syncLogError);
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

    const now = new Date().toISOString();
    let totalRecordsFetched = 0;
    let totalRecordsCreated = 0;
    const byType: Record<string, number> = {};

    // Fetch and sync each activity type
    for (const activityType of activityTypes) {
      console.log(`[syncHubSpotActivities] Fetching ${activityType}...`);

      try {
        const result = await fetchActivities(client, activityType);

        if (!result.success || !result.records) {
          console.error(`[syncHubSpotActivities] Failed to fetch ${activityType}:`, result.error);
          continue;
        }

        console.log(`[syncHubSpotActivities] Fetched ${result.records.length} ${activityType}`);
        totalRecordsFetched += result.records.length;
        byType[activityType] = result.records.length;

        if (result.records.length === 0) continue;

        // Transform records
        const activityRecords = result.records.map((record) => {
          const props = record.properties;
          return {
            organization_id: organizationId,
            hubspot_activity_id: record.id,
            activity_type: activityType,
            deal_id: props.hs_deal_id || props.associated_deals_id || null,
            contact_id: props.hs_contact_id || props.associated_contacts_id || null,
            company_id: props.hs_company_id || props.associated_companies_id || null,
            owner_id: props.hubspot_owner_id || null,
            subject: getActivitySubject(activityType, props),
            body: getActivityBody(activityType, props),
            activity_date: parseDate(props.hs_timestamp),
            duration_ms: parseDuration(activityType, props),
            properties: props,
            synced_at: now,
          };
        });

        // Upsert activities in batches
        const batchSize = 100;
        for (let i = 0; i < activityRecords.length; i += batchSize) {
          const batch = activityRecords.slice(i, i + batchSize);

          const { error } = await supabase
            .from("hubspot_activities")
            .upsert(batch, {
              onConflict: "organization_id,hubspot_activity_id",
              ignoreDuplicates: false,
            });

          if (error) {
            console.error(`[syncHubSpotActivities] Failed to upsert ${activityType}:`, error);
          } else {
            totalRecordsCreated += batch.length;
          }
        }
      } catch (error) {
        console.error(`[syncHubSpotActivities] Error syncing ${activityType}:`, error);
        // Continue with other activity types
      }
    }

    console.log("[syncHubSpotActivities] Sync complete:", {
      totalRecordsFetched,
      totalRecordsCreated,
      byType,
    });

    // Update sync log
    await updateSyncLog(supabase, syncLogId, "success", undefined, {
      records_fetched: totalRecordsFetched,
      records_created: totalRecordsCreated,
    });

    return {
      success: true,
      recordsFetched: totalRecordsFetched,
      recordsCreated: totalRecordsCreated,
      byType,
      syncLogId,
    };
  } catch (error) {
    console.error("[syncHubSpotActivities] Error:", error);
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
 * Fetch activities of a specific type from HubSpot
 */
async function fetchActivities(
  client: HubSpotClient,
  activityType: ActivityType
): Promise<{ success: boolean; records?: Array<{ id: string; properties: Record<string, string | null> }>; error?: string }> {
  const properties = ACTIVITY_PROPERTIES[activityType];

  // HubSpot engagement objects use different object types
  const objectType = activityType as "calls" | "emails" | "meetings" | "notes" | "tasks";

  try {
    // Use the fetchRawRecords method with deal associations
    const result = await client.fetchRawRecords(
      objectType as never, // Type assertion needed since these aren't in HubSpotObject type
      properties,
      undefined,
      ["deals", "contacts", "companies"]
    );

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get the subject/title for an activity
 */
function getActivitySubject(
  activityType: ActivityType,
  props: Record<string, string | null>
): string | null {
  switch (activityType) {
    case "calls":
      return props.hs_call_title || null;
    case "emails":
      return props.hs_email_subject || null;
    case "meetings":
      return props.hs_meeting_title || null;
    case "tasks":
      return props.hs_task_subject || null;
    case "notes":
      return null; // Notes don't have subjects
    default:
      return null;
  }
}

/**
 * Get the body content for an activity
 */
function getActivityBody(
  activityType: ActivityType,
  props: Record<string, string | null>
): string | null {
  switch (activityType) {
    case "calls":
      return props.hs_call_body || null;
    case "emails":
      return props.hs_email_text || null;
    case "meetings":
      return props.hs_meeting_body || null;
    case "tasks":
      return props.hs_task_body || null;
    case "notes":
      return props.hs_note_body || null;
    default:
      return null;
  }
}

/**
 * Get the duration in milliseconds for an activity
 */
function parseDuration(
  activityType: ActivityType,
  props: Record<string, string | null>
): number | null {
  if (activityType === "calls") {
    // Call duration is in milliseconds
    const duration = props.hs_call_duration;
    if (duration) {
      const ms = parseInt(duration, 10);
      return isNaN(ms) ? null : ms;
    }
  }

  if (activityType === "meetings") {
    // Calculate meeting duration from start/end times
    const start = props.hs_meeting_start_time;
    const end = props.hs_meeting_end_time;
    if (start && end) {
      const startMs = new Date(start).getTime();
      const endMs = new Date(end).getTime();
      if (!isNaN(startMs) && !isNaN(endMs)) {
        return endMs - startMs;
      }
    }
  }

  return null;
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
