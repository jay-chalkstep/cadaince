import type { SlackMessage, SlackBlock } from "./client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.aicomplice.com";

/**
 * Issue queued for L10 meeting
 */
export function issueQueuedTemplate(params: {
  issueTitle: string;
  issueId: string;
  queuedBy: string;
  meetingTitle: string;
  meetingDate: string;
  issueCount: number;
}): SlackMessage {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:dart: *Issue Queued for L10*\n*${params.issueTitle}*`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Added by ${params.queuedBy} • ${params.issueCount} issue${params.issueCount !== 1 ? "s" : ""} queued for ${params.meetingDate}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Issue", emoji: true },
            url: `${APP_URL}/issues/${params.issueId}`,
            action_id: `view:issue:${params.issueId}`,
          },
        ],
      },
    ],
  };
}

/**
 * Rock status changed to off-track
 */
export function rockOffTrackTemplate(params: {
  rockTitle: string;
  rockId: string;
  ownerName: string;
  previousStatus: string;
  rockLevel: string;
}): SlackMessage {
  const levelEmoji = params.rockLevel === "company" ? ":building_construction:" : ":rock:";

  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${levelEmoji} :warning: *Rock Off Track*\n*${params.rockTitle}*`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Owner:*\n${params.ownerName}`,
          },
          {
            type: "mrkdwn",
            text: `*Previous Status:*\n${params.previousStatus.replace("_", " ")}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Rock", emoji: true },
            url: `${APP_URL}/rocks/${params.rockId}`,
            action_id: `view:rock:${params.rockId}`,
          },
        ],
      },
    ],
  };
}

/**
 * L10 meeting reminder (1 hour before)
 */
export function meetingReminderTemplate(params: {
  meetingTitle: string;
  meetingId: string;
  startsAt: string;
  attendeeCount: number;
  issueCount: number;
}): SlackMessage {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:calendar: *L10 Meeting Starting Soon*\n*${params.meetingTitle}*`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Starts:*\n${params.startsAt}`,
          },
          {
            type: "mrkdwn",
            text: `*Issues Queued:*\n${params.issueCount}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open Meeting", emoji: true },
            url: `${APP_URL}/l10/${params.meetingId}`,
            action_id: `view:meeting:${params.meetingId}`,
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Snooze 15 min", emoji: true },
            action_id: `snooze:reminder:${params.meetingId}`,
          },
        ],
      },
    ],
  };
}

/**
 * L10 meeting completed summary
 */
export function meetingSummaryTemplate(params: {
  meetingTitle: string;
  meetingId: string;
  durationMinutes: number;
  avgRating?: number;
  issuesSolved: number;
  todosCreated: number;
}): SlackMessage {
  const ratingText = params.avgRating
    ? `Team Rating: ${params.avgRating.toFixed(1)}/10`
    : "No ratings submitted";

  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:white_check_mark: *L10 Meeting Completed*\n*${params.meetingTitle}*`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Duration:*\n${params.durationMinutes} minutes`,
          },
          {
            type: "mrkdwn",
            text: `*${ratingText}*`,
          },
          {
            type: "mrkdwn",
            text: `*Issues Solved:*\n${params.issuesSolved}`,
          },
          {
            type: "mrkdwn",
            text: `*To-Dos Created:*\n${params.todosCreated}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Summary", emoji: true },
            url: `${APP_URL}/l10/${params.meetingId}`,
            action_id: `view:meeting:${params.meetingId}`,
          },
        ],
      },
    ],
  };
}

/**
 * New issue created
 */
export function issueCreatedTemplate(params: {
  issueTitle: string;
  issueId: string;
  createdBy: string;
  priority: number;
}): SlackMessage {
  const priorityEmoji = params.priority === 1 ? ":rotating_light:" : params.priority === 2 ? ":warning:" : ":information_source:";
  const priorityText = params.priority === 1 ? "High" : params.priority === 2 ? "Medium" : "Low";

  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${priorityEmoji} *New Issue Created*\n*${params.issueTitle}*`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Created by ${params.createdBy} • Priority: ${priorityText}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Issue", emoji: true },
            url: `${APP_URL}/issues/${params.issueId}`,
            action_id: `view:issue:${params.issueId}`,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Resolve", emoji: true },
            action_id: `resolve:issue:${params.issueId}`,
            style: "primary",
          },
        ],
      },
    ],
  };
}

/**
 * Todo overdue reminder
 */
export function todoOverdueTemplate(params: {
  todoTitle: string;
  todoId: string;
  ownerName: string;
  dueDate: string;
  daysOverdue: number;
}): SlackMessage {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:alarm_clock: *To-Do Overdue*\n*${params.todoTitle}*`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Owner:*\n${params.ownerName}`,
          },
          {
            type: "mrkdwn",
            text: `*Due:*\n${params.dueDate} (${params.daysOverdue} day${params.daysOverdue !== 1 ? "s" : ""} overdue)`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Mark Complete", emoji: true },
            action_id: `complete:todo:${params.todoId}`,
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "View To-Do", emoji: true },
            url: `${APP_URL}/todos`,
            action_id: `view:todo:${params.todoId}`,
          },
        ],
      },
    ],
  };
}

/**
 * Headline shared
 */
export function headlineTemplate(params: {
  headlineTitle: string;
  headlineType: "customer" | "employee" | "general";
  sharedBy: string;
  mentionedPerson?: string;
}): SlackMessage {
  const emoji = params.headlineType === "customer" ? ":tada:" : params.headlineType === "employee" ? ":star2:" : ":mega:";
  const typeLabel = params.headlineType === "customer" ? "Customer Win" : params.headlineType === "employee" ? "Employee Recognition" : "Headline";

  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *${typeLabel}*\n${params.headlineTitle}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: params.mentionedPerson
              ? `Shared by ${params.sharedBy} • Recognizing ${params.mentionedPerson}`
              : `Shared by ${params.sharedBy}`,
          },
        ],
      },
    ],
  };
}

/**
 * Scorecard metric below goal
 */
export function scorecardBelowGoalTemplate(params: {
  metricName: string;
  currentValue: number;
  goal: number;
  unit?: string;
  ownerName: string;
}): SlackMessage {
  const unit = params.unit || "";
  const percentOfGoal = Math.round((params.currentValue / params.goal) * 100);

  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:chart_with_downwards_trend: *Scorecard Alert*\n*${params.metricName}* is below goal`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Current:*\n${params.currentValue}${unit}`,
          },
          {
            type: "mrkdwn",
            text: `*Goal:*\n${params.goal}${unit}`,
          },
          {
            type: "mrkdwn",
            text: `*% of Goal:*\n${percentOfGoal}%`,
          },
          {
            type: "mrkdwn",
            text: `*Owner:*\n${params.ownerName}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Scorecard", emoji: true },
            url: `${APP_URL}/scorecard`,
            action_id: "view:scorecard",
          },
        ],
      },
    ],
  };
}
