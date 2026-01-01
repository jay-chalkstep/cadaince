import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/server";
import { SlackClient } from "@/lib/integrations/slack/client";
import { RemarkableClient } from "@/lib/integrations/remarkable/client";
import { generateMeetingAgendaPDF, generateBriefingPDF } from "@/lib/integrations/remarkable/pdf-generator";

// All trigger events we listen to
const TRIGGER_EVENTS = [
  "l10/meeting.created",
  "l10/meeting.updated",
  "l10/meeting.starting_soon",
  "l10/meeting.completed",
  "issue/created",
  "issue/queued",
  "issue/resolved",
  "rock/status.changed",
  "rock/completed",
  "todo/created",
  "todo/overdue",
  "headline/created",
  "scorecard/below_goal",
] as const;

type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

interface AutomationRule {
  id: string;
  name: string;
  trigger_event: string;
  trigger_conditions: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
}

/**
 * Process automations for any integration event
 * Listens to all event types and finds matching automation rules
 */
export const processAutomations = inngest.createFunction(
  {
    id: "process-automations",
    retries: 2,
  },
  TRIGGER_EVENTS.map((event) => ({ event })),
  async ({ event, step }) => {
    const eventType = event.name as TriggerEvent;
    const eventData = event.data as Record<string, unknown>;
    const organizationId = eventData.organization_id as string;

    if (!organizationId) {
      return { skipped: true, reason: "no_organization_id" };
    }

    const supabase = createAdminClient();

    // Find matching active automations
    const automations = await step.run("find-automations", async () => {
      const { data } = await supabase
        .from("integration_automations")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("trigger_event", eventType)
        .eq("is_active", true);

      return (data || []) as AutomationRule[];
    });

    if (automations.length === 0) {
      return { processed: 0, reason: "no_matching_automations" };
    }

    // Log the event
    const eventRecord = await step.run("log-event", async () => {
      const { data } = await supabase
        .from("integration_events")
        .insert({
          organization_id: organizationId,
          event_type: eventType,
          payload: eventData,
        })
        .select()
        .single();

      return data;
    });

    let processed = 0;
    let failed = 0;

    // Process each automation
    for (const automation of automations) {
      await step.run(`process-${automation.id}`, async () => {
        // Check trigger conditions
        if (!evaluateConditions(automation.trigger_conditions, eventData)) {
          await logAutomationAction(supabase, {
            automation_id: automation.id,
            event_id: eventRecord?.id,
            event_type: eventType,
            event_data: eventData,
            status: "skipped",
            result: { reason: "conditions_not_met" },
          });
          return;
        }

        // Create log entry
        const { data: logEntry } = await supabase
          .from("automation_action_log")
          .insert({
            automation_id: automation.id,
            event_id: eventRecord?.id,
            event_type: eventType,
            event_data: eventData,
            status: "running",
          })
          .select()
          .single();

        try {
          // Execute the action
          const result = await executeAction(
            automation.action_type,
            automation.action_config,
            eventData,
            organizationId
          );

          // Update log with success
          await supabase
            .from("automation_action_log")
            .update({
              status: "success",
              result,
              completed_at: new Date().toISOString(),
            })
            .eq("id", logEntry?.id);

          processed++;
        } catch (err) {
          // Update log with error
          await supabase
            .from("automation_action_log")
            .update({
              status: "error",
              error_message: err instanceof Error ? err.message : "Unknown error",
              completed_at: new Date().toISOString(),
            })
            .eq("id", logEntry?.id);

          failed++;
        }
      });
    }

    return { processed, failed, total: automations.length };
  }
);

/**
 * Handle test automation runs
 */
export const processTestAutomation = inngest.createFunction(
  {
    id: "process-test-automation",
    retries: 1,
  },
  { event: "automation/test" },
  async ({ event, step }) => {
    const { automation_id, organization_id, trigger_event, event_data } = event.data as {
      automation_id: string;
      organization_id: string;
      trigger_event: string;
      event_data: Record<string, unknown>;
    };

    const supabase = createAdminClient();

    // Get the automation
    const automation = await step.run("get-automation", async () => {
      const { data } = await supabase
        .from("integration_automations")
        .select("*")
        .eq("id", automation_id)
        .single();

      return data as AutomationRule | null;
    });

    if (!automation) {
      return { error: "Automation not found" };
    }

    // Create log entry
    const { data: logEntry } = await supabase
      .from("automation_action_log")
      .insert({
        automation_id,
        event_type: trigger_event,
        event_data: { ...event_data, is_test: true },
        status: "running",
      })
      .select()
      .single();

    try {
      // Check conditions
      if (!evaluateConditions(automation.trigger_conditions, event_data)) {
        await supabase
          .from("automation_action_log")
          .update({
            status: "skipped",
            result: { reason: "conditions_not_met", is_test: true },
            completed_at: new Date().toISOString(),
          })
          .eq("id", logEntry?.id);

        return { skipped: true, reason: "conditions_not_met" };
      }

      // Execute action
      const result = await executeAction(
        automation.action_type,
        automation.action_config,
        event_data,
        organization_id
      );

      await supabase
        .from("automation_action_log")
        .update({
          status: "success",
          result: { ...result, is_test: true },
          completed_at: new Date().toISOString(),
        })
        .eq("id", logEntry?.id);

      return { success: true, result };
    } catch (err) {
      await supabase
        .from("automation_action_log")
        .update({
          status: "error",
          error_message: err instanceof Error ? err.message : "Unknown error",
          completed_at: new Date().toISOString(),
        })
        .eq("id", logEntry?.id);

      return { error: err instanceof Error ? err.message : "Unknown error" };
    }
  }
);

/**
 * Evaluate trigger conditions against event data
 */
function evaluateConditions(
  conditions: Record<string, unknown>,
  eventData: Record<string, unknown>
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true; // No conditions means always trigger
  }

  for (const [key, expectedValue] of Object.entries(conditions)) {
    const actualValue = eventData[key];

    // Handle special operators
    if (typeof expectedValue === "object" && expectedValue !== null) {
      const condition = expectedValue as Record<string, unknown>;

      if ("$eq" in condition) {
        if (actualValue !== condition.$eq) return false;
      }
      if ("$ne" in condition) {
        if (actualValue === condition.$ne) return false;
      }
      if ("$in" in condition && Array.isArray(condition.$in)) {
        if (!condition.$in.includes(actualValue)) return false;
      }
      if ("$gt" in condition) {
        if (typeof actualValue !== "number" || actualValue <= (condition.$gt as number)) return false;
      }
      if ("$lt" in condition) {
        if (typeof actualValue !== "number" || actualValue >= (condition.$lt as number)) return false;
      }
      if ("$exists" in condition) {
        const exists = actualValue !== undefined && actualValue !== null;
        if (condition.$exists !== exists) return false;
      }
    } else {
      // Simple equality check
      if (actualValue !== expectedValue) return false;
    }
  }

  return true;
}

/**
 * Execute an automation action
 */
async function executeAction(
  actionType: string,
  actionConfig: Record<string, unknown>,
  eventData: Record<string, unknown>,
  organizationId: string
): Promise<Record<string, unknown>> {
  switch (actionType) {
    case "slack_channel_message":
      return await executeSlackChannelMessage(actionConfig, eventData, organizationId);

    case "slack_dm":
      return await executeSlackDM(actionConfig, eventData, organizationId);

    case "push_remarkable":
      return await executePushRemarkable(actionConfig, eventData, organizationId);

    case "webhook":
      return await executeWebhook(actionConfig, eventData);

    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

async function executeSlackChannelMessage(
  config: Record<string, unknown>,
  eventData: Record<string, unknown>,
  organizationId: string
): Promise<Record<string, unknown>> {
  const client = await SlackClient.fromOrganization(organizationId);
  if (!client) {
    throw new Error("Slack not connected for this organization");
  }

  const channelId = config.channel_id as string;
  const messageTemplate = (config.message_template as string) || formatDefaultMessage(eventData);
  const message = interpolateTemplate(messageTemplate, eventData);

  await client.sendMessage(channelId, { text: message });

  return { channel_id: channelId, message_sent: true };
}

async function executeSlackDM(
  config: Record<string, unknown>,
  eventData: Record<string, unknown>,
  organizationId: string
): Promise<Record<string, unknown>> {
  const client = await SlackClient.fromOrganization(organizationId);
  if (!client) {
    throw new Error("Slack not connected for this organization");
  }

  // Get Slack user ID from config or event data
  let slackUserId = config.slack_user_id as string | undefined;

  if (!slackUserId && config.user_field) {
    const profileId = eventData[config.user_field as string] as string;
    if (profileId) {
      const supabase = createAdminClient();
      const { data: mapping } = await supabase
        .from("slack_user_mappings")
        .select("slack_user_id")
        .eq("organization_id", organizationId)
        .eq("profile_id", profileId)
        .single();

      slackUserId = mapping?.slack_user_id;
    }
  }

  if (!slackUserId) {
    throw new Error("Could not determine Slack user for DM");
  }

  const messageTemplate = (config.message_template as string) || formatDefaultMessage(eventData);
  const message = interpolateTemplate(messageTemplate, eventData);

  await client.sendDM(slackUserId, { text: message });

  return { slack_user_id: slackUserId, dm_sent: true };
}

async function executePushRemarkable(
  config: Record<string, unknown>,
  eventData: Record<string, unknown>,
  organizationId: string
): Promise<Record<string, unknown>> {
  const documentType = config.document_type as string;
  const targetUserField = (config.target_user_field as string) || "owner_id";
  const profileId = eventData[targetUserField] as string;

  if (!profileId) {
    throw new Error(`No profile ID found in event data field: ${targetUserField}`);
  }

  const client = await RemarkableClient.fromProfile(profileId);
  if (!client) {
    throw new Error("reMarkable not connected for this user");
  }

  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from("remarkable_settings")
    .select("folder_path")
    .eq("profile_id", profileId)
    .single();

  const folderPath = settings?.folder_path || "/Aicomplice";

  let pdfBuffer: Buffer;
  let title: string;

  switch (documentType) {
    case "meeting_agenda":
      const meetingId = eventData.meeting_id as string;
      if (!meetingId) throw new Error("No meeting_id in event data");
      pdfBuffer = await generateMeetingAgendaPDF(meetingId);
      title = (eventData.title as string) || "L10 Meeting Agenda";
      break;

    case "briefing":
      const briefingId = eventData.briefing_id as string;
      if (!briefingId) throw new Error("No briefing_id in event data");
      pdfBuffer = await generateBriefingPDF(briefingId);
      title = "Morning Briefing";
      break;

    default:
      throw new Error(`Unknown document type: ${documentType}`);
  }

  const docId = await client.uploadDocument(pdfBuffer, title, folderPath);

  // Record the push
  await supabase.from("remarkable_documents").insert({
    profile_id: profileId,
    organization_id: organizationId,
    remarkable_doc_id: docId,
    document_type: documentType,
    source_id: eventData.meeting_id || eventData.briefing_id || null,
    title,
    status: "pushed",
  });

  return { document_id: docId, pushed: true };
}

async function executeWebhook(
  config: Record<string, unknown>,
  eventData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = config.url as string;
  const method = (config.method as string) || "POST";
  const headers = (config.headers as Record<string, string>) || {};

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(eventData),
  });

  return {
    url,
    status: response.status,
    success: response.ok,
  };
}

function formatDefaultMessage(eventData: Record<string, unknown>): string {
  const title = eventData.title as string;
  const eventType = eventData.event_type as string;

  if (title) {
    return `*${eventType}*: ${title}`;
  }
  return `Event triggered: ${eventType}`;
}

function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key];
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
}

async function logAutomationAction(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    automation_id: string;
    event_id?: string;
    event_type: string;
    event_data: Record<string, unknown>;
    status: string;
    result?: Record<string, unknown>;
    error_message?: string;
  }
) {
  await supabase.from("automation_action_log").insert({
    automation_id: params.automation_id,
    event_id: params.event_id || null,
    event_type: params.event_type,
    event_data: params.event_data,
    status: params.status,
    result: params.result || null,
    error_message: params.error_message || null,
    completed_at: new Date().toISOString(),
  });
}

// Export all automation functions
export const automationFunctions = [processAutomations, processTestAutomation];
