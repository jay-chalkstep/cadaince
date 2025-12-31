import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifySlackRequest, parseSlashCommandBody } from "@/lib/integrations/slack/verify";

// POST /api/integrations/slack/commands - Handle /aicomplice slash command
export async function POST(req: Request) {
  // Verify the request came from Slack
  const isValid = await verifySlackRequest(req);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const bodyText = await req.text();
  const command = parseSlashCommandBody(bodyText);

  const {
    command: slashCommand,
    text,
    user_id: slackUserId,
    team_id: workspaceId,
    channel_id: channelId,
    response_url: responseUrl,
  } = command;

  const supabase = createAdminClient();

  // Find the organization from workspace
  const { data: workspace } = await supabase
    .from("slack_workspaces")
    .select("organization_id")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .single();

  if (!workspace) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "This Slack workspace is not connected to Aicomplice. Please ask an admin to connect it.",
    });
  }

  // Find the user's profile from mapping
  const { data: userMapping } = await supabase
    .from("slack_user_mappings")
    .select("profile_id")
    .eq("organization_id", workspace.organization_id)
    .eq("slack_user_id", slackUserId)
    .single();

  const profileId = userMapping?.profile_id;

  // Parse the command text
  const args = text?.trim().split(/\s+/) || [];
  const subcommand = args[0]?.toLowerCase();
  const restArgs = args.slice(1).join(" ");

  switch (subcommand) {
    case "issue":
      return handleIssueCommand(restArgs, profileId, workspace.organization_id, supabase);

    case "todo":
      return handleTodoCommand(restArgs, profileId, workspace.organization_id, supabase);

    case "rocks":
      return handleRocksCommand(workspace.organization_id, supabase);

    case "scorecard":
      return handleScorecardCommand(workspace.organization_id, supabase);

    case "next-l10":
    case "nextl10":
      return handleNextL10Command(workspace.organization_id, supabase);

    case "help":
    default:
      return NextResponse.json({
        response_type: "ephemeral",
        text: "*Aicomplice Commands*\n\n" +
          "• `/aicomplice issue \"title\"` - Create a new issue\n" +
          "• `/aicomplice todo \"title\"` - Create a new to-do\n" +
          "• `/aicomplice rocks` - View current quarter's rocks\n" +
          "• `/aicomplice scorecard` - View scorecard summary\n" +
          "• `/aicomplice next-l10` - See upcoming L10 meetings\n" +
          "• `/aicomplice help` - Show this help message",
      });
  }
}

async function handleIssueCommand(
  text: string,
  profileId: string | null,
  organizationId: string,
  supabase: ReturnType<typeof createAdminClient>
) {
  if (!profileId) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Your Slack account is not linked to an Aicomplice profile. Please ask an admin to link your account.",
    });
  }

  // Extract title from quotes or use entire text
  const titleMatch = text.match(/"([^"]+)"/);
  const title = titleMatch ? titleMatch[1] : text;

  if (!title) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: 'Please provide an issue title: `/aicomplice issue "Your issue title"`',
    });
  }

  // Create the issue
  const { data: issue, error } = await supabase
    .from("issues")
    .insert({
      title,
      organization_id: organizationId,
      raised_by: profileId,
      created_by: profileId,
      owner_id: profileId,
      status: "open",
      priority: 2,
    })
    .select("id, title")
    .single();

  if (error) {
    console.error("Error creating issue:", error);
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Failed to create issue. Please try again.",
    });
  }

  return NextResponse.json({
    response_type: "in_channel",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:dart: *New Issue Created*\n*${issue.title}*`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Created via Slack • <${process.env.NEXT_PUBLIC_APP_URL}/issues|View in Aicomplice>`,
          },
        ],
      },
    ],
  });
}

async function handleTodoCommand(
  text: string,
  profileId: string | null,
  organizationId: string,
  supabase: ReturnType<typeof createAdminClient>
) {
  if (!profileId) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Your Slack account is not linked to an Aicomplice profile. Please ask an admin to link your account.",
    });
  }

  // Extract title from quotes or use entire text
  const titleMatch = text.match(/"([^"]+)"/);
  const title = titleMatch ? titleMatch[1] : text;

  if (!title) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: 'Please provide a to-do title: `/aicomplice todo "Your to-do title"`',
    });
  }

  // Create the todo with due date 7 days from now
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  const { data: todo, error } = await supabase
    .from("todos")
    .insert({
      title,
      organization_id: organizationId,
      owner_id: profileId,
      created_by: profileId,
      status: "pending",
      due_date: dueDate.toISOString().split("T")[0],
      visibility: "team",
    })
    .select("id, title, due_date")
    .single();

  if (error) {
    console.error("Error creating todo:", error);
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Failed to create to-do. Please try again.",
    });
  }

  return NextResponse.json({
    response_type: "in_channel",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:white_check_mark: *New To-Do Created*\n*${todo.title}*\nDue: ${new Date(todo.due_date).toLocaleDateString()}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Created via Slack • <${process.env.NEXT_PUBLIC_APP_URL}/todos|View in Aicomplice>`,
          },
        ],
      },
    ],
  });
}

async function handleRocksCommand(
  organizationId: string,
  supabase: ReturnType<typeof createAdminClient>
) {
  // Get current quarter
  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();

  const { data: rocks } = await supabase
    .from("rocks")
    .select(`
      title,
      status,
      rock_level,
      owner:profiles!owner_id(full_name)
    `)
    .eq("organization_id", organizationId)
    .eq("rock_level", "company")
    .order("title");

  if (!rocks || rocks.length === 0) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "No company rocks found for this quarter.",
    });
  }

  const statusEmoji: Record<string, string> = {
    on_track: ":large_green_circle:",
    at_risk: ":large_yellow_circle:",
    off_track: ":red_circle:",
    complete: ":white_check_mark:",
    done: ":white_check_mark:",
  };

  const rockList = rocks
    .map((r) => {
      const owner = Array.isArray(r.owner) ? r.owner[0] : r.owner;
      const emoji = statusEmoji[r.status] || ":white_circle:";
      return `${emoji} *${r.title}* — ${owner?.full_name || "Unassigned"}`;
    })
    .join("\n");

  return NextResponse.json({
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `Q${currentQuarter} ${currentYear} Company Rocks`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: rockList,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${process.env.NEXT_PUBLIC_APP_URL}/rocks|View all rocks in Aicomplice>`,
          },
        ],
      },
    ],
  });
}

async function handleScorecardCommand(
  organizationId: string,
  supabase: ReturnType<typeof createAdminClient>
) {
  const { data: metrics } = await supabase
    .from("metrics")
    .select(`
      name,
      current_value,
      goal,
      unit,
      owner:profiles!metrics_owner_id_fkey(full_name)
    `)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name")
    .limit(10);

  if (!metrics || metrics.length === 0) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "No scorecard metrics found.",
    });
  }

  const metricList = metrics
    .map((m) => {
      const current = m.current_value ?? "—";
      const goal = m.goal ?? "—";
      const status = m.current_value !== null && m.goal !== null
        ? (m.current_value >= m.goal ? ":large_green_circle:" : ":red_circle:")
        : ":white_circle:";
      return `${status} *${m.name}*: ${current}${m.unit || ""} / ${goal}${m.unit || ""}`;
    })
    .join("\n");

  return NextResponse.json({
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Scorecard Summary",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: metricList,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${process.env.NEXT_PUBLIC_APP_URL}/scorecard|View full scorecard in Aicomplice>`,
          },
        ],
      },
    ],
  });
}

async function handleNextL10Command(
  organizationId: string,
  supabase: ReturnType<typeof createAdminClient>
) {
  const { data: meetings } = await supabase
    .from("l10_meetings")
    .select(`
      id,
      title,
      scheduled_at,
      status
    `)
    .eq("organization_id", organizationId)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(5);

  if (!meetings || meetings.length === 0) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "No upcoming L10 meetings scheduled.",
    });
  }

  const meetingList = meetings
    .map((m) => {
      const date = new Date(m.scheduled_at);
      const formattedDate = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const formattedTime = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      return `• *${m.title}* — ${formattedDate} at ${formattedTime}`;
    })
    .join("\n");

  return NextResponse.json({
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Upcoming L10 Meetings",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: meetingList,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${process.env.NEXT_PUBLIC_APP_URL}/l10|View all meetings in Aicomplice>`,
          },
        ],
      },
    ],
  });
}
