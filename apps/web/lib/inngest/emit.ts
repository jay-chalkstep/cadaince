import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Event types that can be emitted to trigger integrations.
 * These events are logged to the database for audit trail and sent to Inngest for processing.
 */
export type IntegrationEventType =
  // L10 Meeting events
  | "l10/meeting.created"
  | "l10/meeting.updated"
  | "l10/meeting.starting_soon"
  | "l10/meeting.started"
  | "l10/meeting.completed"
  // Issue events
  | "issue/created"
  | "issue/queued"
  | "issue/resolved"
  // Rock events
  | "rock/created"
  | "rock/status.changed"
  | "rock/completed"
  // To-do events
  | "todo/created"
  | "todo/completed"
  | "todo/overdue"
  // Headline events
  | "headline/created"
  // Scorecard events
  | "scorecard/below_goal"
  | "scorecard/entry.created";

/**
 * Base payload structure for integration events.
 * All events must include organization_id for multi-tenant scoping.
 */
export interface IntegrationEventPayload {
  organization_id: string;
  [key: string]: unknown;
}

/**
 * Emits an integration event to both the database (for audit trail) and Inngest (for processing).
 *
 * This is the primary way to trigger integrations from application code.
 * Call this function whenever an entity changes that might need to trigger
 * notifications, calendar syncs, or other integration actions.
 *
 * @param type - The type of event being emitted
 * @param payload - Event data including organization_id and entity-specific fields
 *
 * @example
 * // Emit when a new L10 meeting is created
 * await emitIntegrationEvent('l10/meeting.created', {
 *   organization_id: profile.organization_id,
 *   meeting_id: meeting.id,
 *   title: meeting.title,
 *   scheduled_at: meeting.scheduled_at,
 * });
 *
 * @example
 * // Emit when a rock status changes
 * await emitIntegrationEvent('rock/status.changed', {
 *   organization_id: rock.organization_id,
 *   rock_id: rock.id,
 *   old_status: 'on_track',
 *   new_status: 'off_track',
 *   owner_id: rock.owner_id,
 * });
 */
export async function emitIntegrationEvent(
  type: IntegrationEventType,
  payload: IntegrationEventPayload
): Promise<void> {
  const supabase = createAdminClient();

  // Log to database for audit trail
  // This happens first to ensure we have a record even if Inngest fails
  const { error: dbError } = await supabase.from("integration_events").insert({
    organization_id: payload.organization_id,
    event_type: type,
    payload,
  });

  if (dbError) {
    console.error("Failed to log integration event to database:", dbError);
    // Continue to send to Inngest anyway - the event is still valuable
  }

  // Send to Inngest for processing
  try {
    await inngest.send({
      name: type,
      data: payload,
    });
  } catch (inngestError) {
    console.error("Failed to send integration event to Inngest:", inngestError);
    // Don't throw - we don't want integration failures to break core functionality
  }
}

/**
 * Emits multiple integration events in a batch.
 * Useful when a single action triggers multiple event types.
 *
 * @param events - Array of events to emit
 */
export async function emitIntegrationEvents(
  events: Array<{ type: IntegrationEventType; payload: IntegrationEventPayload }>
): Promise<void> {
  await Promise.all(
    events.map(({ type, payload }) => emitIntegrationEvent(type, payload))
  );
}
