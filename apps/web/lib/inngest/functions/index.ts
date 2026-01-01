// Integration event-driven functions

// Calendar functions
import { calendarFunctions } from "./calendar";

// Slack functions
import { slackFunctions } from "./slack";

// reMarkable functions
import { remarkableFunctions } from "./remarkable";

// Automations framework
import { automationFunctions } from "./automations";

// Team sync (from Accountability Chart)
import { teamSyncFunctions } from "./team-sync";

// Export all functions for Inngest
export const functions = [
  ...calendarFunctions,
  ...slackFunctions,
  ...remarkableFunctions,
  ...automationFunctions,
  ...teamSyncFunctions,
];
