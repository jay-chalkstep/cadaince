// Integration event-driven functions

// Calendar functions
import { calendarFunctions } from "./calendar";

// Slack functions
import { slackFunctions } from "./slack";

// reMarkable functions
import { remarkableFunctions } from "./remarkable";

// Export all functions for Inngest
export const functions = [
  ...calendarFunctions,
  ...slackFunctions,
  ...remarkableFunctions,
];
