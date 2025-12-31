// Integration event-driven functions

// Calendar functions
import { calendarFunctions } from "./calendar";

// Slack functions (Phase 3)
// import { slackFunctions } from './slack';

// reMarkable functions (Phase 4)
// import { remarkableFunctions } from './remarkable';

// Export all functions for Inngest
export const functions = [
  ...calendarFunctions,
  // ...slackFunctions,
  // ...remarkableFunctions,
];
