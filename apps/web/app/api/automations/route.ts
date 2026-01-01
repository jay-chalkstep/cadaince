import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

// Valid trigger events
export const TRIGGER_EVENTS = [
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

// Valid action types
export const ACTION_TYPES = [
  "slack_channel_message",
  "slack_dm",
  "push_remarkable",
  "webhook",
] as const;

export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];
export type ActionType = (typeof ACTION_TYPES)[number];

// GET - List all automations for the organization
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("clerk_id", userId)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { data: automations, error } = await supabase
      .from("integration_automations")
      .select(`
        id,
        name,
        description,
        trigger_event,
        trigger_conditions,
        action_type,
        action_config,
        is_active,
        created_by,
        created_at,
        updated_at,
        creator:profiles!created_by(full_name)
      `)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching automations:", error);
      return NextResponse.json({ error: "Failed to fetch automations" }, { status: 500 });
    }

    return NextResponse.json({ automations: automations || [] });
  } catch (error) {
    console.error("Error in GET automations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new automation
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, trigger_event, trigger_conditions, action_type, action_config } = body;

    // Validate required fields
    if (!name || !trigger_event || !action_type || !action_config) {
      return NextResponse.json(
        { error: "Missing required fields: name, trigger_event, action_type, action_config" },
        { status: 400 }
      );
    }

    // Validate trigger event
    if (!TRIGGER_EVENTS.includes(trigger_event)) {
      return NextResponse.json(
        { error: `Invalid trigger_event. Must be one of: ${TRIGGER_EVENTS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate action type
    if (!ACTION_TYPES.includes(action_type)) {
      return NextResponse.json(
        { error: `Invalid action_type. Must be one of: ${ACTION_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id, access_level")
      .eq("clerk_id", userId)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.access_level !== "admin") {
      return NextResponse.json(
        { error: "Admin access required to create automations" },
        { status: 403 }
      );
    }

    // Validate action config based on action type
    const configError = validateActionConfig(action_type, action_config);
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 400 });
    }

    const { data: automation, error } = await supabase
      .from("integration_automations")
      .insert({
        organization_id: profile.organization_id,
        name,
        description: description || null,
        trigger_event,
        trigger_conditions: trigger_conditions || {},
        action_type,
        action_config,
        is_active: true,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating automation:", error);
      return NextResponse.json({ error: "Failed to create automation" }, { status: 500 });
    }

    return NextResponse.json({ automation }, { status: 201 });
  } catch (error) {
    console.error("Error in POST automations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function validateActionConfig(actionType: string, config: Record<string, unknown>): string | null {
  switch (actionType) {
    case "slack_channel_message":
      if (!config.channel_id) {
        return "slack_channel_message requires channel_id in action_config";
      }
      break;
    case "slack_dm":
      if (!config.user_field && !config.slack_user_id) {
        return "slack_dm requires user_field or slack_user_id in action_config";
      }
      break;
    case "push_remarkable":
      if (!config.document_type) {
        return "push_remarkable requires document_type in action_config";
      }
      break;
    case "webhook":
      if (!config.url) {
        return "webhook requires url in action_config";
      }
      break;
  }
  return null;
}
