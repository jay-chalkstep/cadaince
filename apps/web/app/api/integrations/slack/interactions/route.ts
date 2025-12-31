import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifySlackRequest, parseInteractionPayload } from "@/lib/integrations/slack/verify";
import { SlackClient } from "@/lib/integrations/slack/client";

// POST /api/integrations/slack/interactions - Handle button clicks, modal submissions
export async function POST(req: Request) {
  // Verify the request came from Slack
  const isValid = await verifySlackRequest(req);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const bodyText = await req.text();
  const payload = parseInteractionPayload(bodyText);

  if (!payload) {
    return new Response("Invalid payload", { status: 400 });
  }

  const { type, team, user, actions, response_url, trigger_id } = payload as {
    type: string;
    team: { id: string };
    user: { id: string };
    actions?: Array<{ action_id: string; value?: string; block_id?: string }>;
    response_url?: string;
    trigger_id?: string;
  };

  const supabase = createAdminClient();

  // Find the organization from workspace
  const { data: workspace } = await supabase
    .from("slack_workspaces")
    .select("organization_id")
    .eq("workspace_id", team.id)
    .eq("is_active", true)
    .single();

  if (!workspace) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "This Slack workspace is not connected to Aicomplice.",
    });
  }

  // Find the user's profile
  const { data: userMapping } = await supabase
    .from("slack_user_mappings")
    .select("profile_id")
    .eq("organization_id", workspace.organization_id)
    .eq("slack_user_id", user.id)
    .single();

  const profileId = userMapping?.profile_id;

  // Handle different interaction types
  switch (type) {
    case "block_actions":
      return handleBlockActions(
        actions || [],
        profileId,
        workspace.organization_id,
        response_url,
        supabase
      );

    case "view_submission":
      // Handle modal submissions if needed in the future
      return NextResponse.json({ response_action: "clear" });

    case "shortcut":
    case "message_action":
      // Handle shortcuts and message actions
      return NextResponse.json({
        response_type: "ephemeral",
        text: "This action is not yet implemented.",
      });

    default:
      return new Response("OK", { status: 200 });
  }
}

async function handleBlockActions(
  actions: Array<{ action_id: string; value?: string; block_id?: string }>,
  profileId: string | null,
  organizationId: string,
  responseUrl: string | undefined,
  supabase: ReturnType<typeof createAdminClient>
) {
  for (const action of actions) {
    const { action_id, value } = action;

    // Parse action_id format: "action_type:entity_type:entity_id"
    const parts = action_id.split(":");
    const actionType = parts[0];
    const entityType = parts[1];
    const entityId = parts[2] || value;

    switch (`${actionType}:${entityType}`) {
      case "resolve:issue":
        if (!profileId) {
          return sendEphemeralResponse(responseUrl, "Your Slack account is not linked.");
        }
        await handleResolveIssue(entityId, profileId, organizationId, responseUrl, supabase);
        break;

      case "complete:todo":
        if (!profileId) {
          return sendEphemeralResponse(responseUrl, "Your Slack account is not linked.");
        }
        await handleCompleteTodo(entityId, profileId, organizationId, responseUrl, supabase);
        break;

      case "view:issue":
      case "view:rock":
      case "view:todo":
        // These are just link buttons, no action needed
        break;

      case "snooze:reminder":
        // Handle snooze for meeting reminders
        await sendEphemeralResponse(responseUrl, "Reminder snoozed for 15 minutes.");
        break;

      default:
        console.log("Unhandled action:", action_id);
    }
  }

  return new Response("OK", { status: 200 });
}

async function handleResolveIssue(
  issueId: string,
  profileId: string,
  organizationId: string,
  responseUrl: string | undefined,
  supabase: ReturnType<typeof createAdminClient>
) {
  const { error } = await supabase
    .from("issues")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: profileId,
    })
    .eq("id", issueId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("Error resolving issue:", error);
    await sendEphemeralResponse(responseUrl, "Failed to resolve issue.");
    return;
  }

  // Update the original message
  if (responseUrl) {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replace_original: true,
        text: ":white_check_mark: Issue resolved!",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: ":white_check_mark: *Issue Resolved*\nThis issue has been marked as resolved.",
            },
          },
        ],
      }),
    });
  }
}

async function handleCompleteTodo(
  todoId: string,
  profileId: string,
  organizationId: string,
  responseUrl: string | undefined,
  supabase: ReturnType<typeof createAdminClient>
) {
  const { error } = await supabase
    .from("todos")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
    })
    .eq("id", todoId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("Error completing todo:", error);
    await sendEphemeralResponse(responseUrl, "Failed to complete to-do.");
    return;
  }

  // Update the original message
  if (responseUrl) {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replace_original: true,
        text: ":white_check_mark: To-do completed!",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: ":white_check_mark: *To-Do Completed*\nThis to-do has been marked as done.",
            },
          },
        ],
      }),
    });
  }
}

async function sendEphemeralResponse(responseUrl: string | undefined, text: string) {
  if (!responseUrl) return;

  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      response_type: "ephemeral",
      text,
    }),
  });
}
