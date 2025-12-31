import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifySlackRequest } from "@/lib/integrations/slack/verify";
import { SlackClient } from "@/lib/integrations/slack/client";

// POST /api/integrations/slack/events - Handle Slack events (app_mention, etc.)
export async function POST(req: Request) {
  // Clone request for verification (needs body twice)
  const clonedReq = req.clone();
  const bodyText = await req.text();
  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(bodyText);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Handle URL verification challenge
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Verify the request for all other events
  const verifyReq = new Request(clonedReq.url, {
    method: clonedReq.method,
    headers: clonedReq.headers,
    body: bodyText,
  });

  const isValid = await verifySlackRequest(verifyReq);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  // Process the event
  const event = payload.event as {
    type: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    team?: string;
  } | undefined;

  if (!event) {
    return new Response("OK", { status: 200 });
  }

  const teamId = (payload.team_id as string) || event.team;
  if (!teamId) {
    return new Response("OK", { status: 200 });
  }

  const supabase = createAdminClient();

  // Find the organization
  const { data: workspace } = await supabase
    .from("slack_workspaces")
    .select("organization_id")
    .eq("workspace_id", teamId)
    .eq("is_active", true)
    .single();

  if (!workspace) {
    return new Response("OK", { status: 200 });
  }

  switch (event.type) {
    case "app_mention":
      await handleAppMention(
        event,
        workspace.organization_id,
        supabase
      );
      break;

    case "member_joined_channel":
      // Could auto-sync user if they join a channel
      break;

    default:
      // Acknowledge but don't process other events
      break;
  }

  return new Response("OK", { status: 200 });
}

async function handleAppMention(
  event: {
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
  },
  organizationId: string,
  supabase: ReturnType<typeof createAdminClient>
) {
  if (!event.channel || !event.ts) return;

  const client = await SlackClient.fromOrganization(organizationId);
  if (!client) return;

  const text = event.text?.toLowerCase() || "";

  // Simple keyword detection for common requests
  if (text.includes("help")) {
    await client.sendMessage(event.channel, {
      text: "Hi! Here's what I can help with:",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Available Commands*\n\n" +
              "Use `/aicomplice` followed by:\n" +
              "• `issue \"title\"` - Create an issue\n" +
              "• `todo \"title\"` - Create a to-do\n" +
              "• `rocks` - View company rocks\n" +
              "• `scorecard` - View scorecard\n" +
              "• `next-l10` - See upcoming meetings",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `<${process.env.NEXT_PUBLIC_APP_URL}|Open Aicomplice>`,
            },
          ],
        },
      ],
      thread_ts: event.ts,
    });
  } else if (text.includes("rocks") || text.includes("quarterly")) {
    await client.sendMessage(event.channel, {
      text: "Use `/aicomplice rocks` to see the current quarter's company rocks!",
      thread_ts: event.ts,
    });
  } else if (text.includes("scorecard") || text.includes("metrics")) {
    await client.sendMessage(event.channel, {
      text: "Use `/aicomplice scorecard` to see your team's metrics!",
      thread_ts: event.ts,
    });
  } else {
    // Default response
    await client.sendMessage(event.channel, {
      text: "Hi! I'm Aicomplice. Use `/aicomplice help` to see what I can do!",
      thread_ts: event.ts,
    });
  }
}
