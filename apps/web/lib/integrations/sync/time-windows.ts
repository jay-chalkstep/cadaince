/**
 * Time Window Utilities
 *
 * Calculates date ranges for different time windows used in metric syncing
 */

export type TimeWindow =
  | "day"
  | "week"
  | "mtd"
  | "qtd"
  | "ytd"
  | "trailing_7"
  | "trailing_30"
  | "trailing_90";

export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Get the start of day (midnight) for a given date
 */
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the start of the week (Monday) for a given date
 */
function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  // Adjust to Monday (1 = Monday, 0 = Sunday needs to go back 6 days)
  const diff = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the start of the month for a given date
 */
function startOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the start of the quarter for a given date
 */
function startOfQuarter(date: Date): Date {
  const result = new Date(date);
  const quarter = Math.floor(result.getMonth() / 3);
  result.setMonth(quarter * 3);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the start of the year for a given date
 */
function startOfYear(date: Date): Date {
  const result = new Date(date);
  result.setMonth(0);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Subtract days from a date
 */
function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * Get the time range for a given time window
 */
export function getTimeRange(window: TimeWindow): TimeRange {
  const now = new Date();
  const end = now;
  let start: Date;

  switch (window) {
    case "day":
      start = startOfDay(now);
      break;
    case "week":
      start = startOfWeek(now);
      break;
    case "mtd":
      start = startOfMonth(now);
      break;
    case "qtd":
      start = startOfQuarter(now);
      break;
    case "ytd":
      start = startOfYear(now);
      break;
    case "trailing_7":
      start = subDays(startOfDay(now), 7);
      break;
    case "trailing_30":
      start = subDays(startOfDay(now), 30);
      break;
    case "trailing_90":
      start = subDays(startOfDay(now), 90);
      break;
    default:
      throw new Error(`Unknown time window: ${window}`);
  }

  return { start, end };
}

/**
 * Format date as ISO date string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Format date as ISO datetime string
 */
export function formatDateTimeISO(date: Date): string {
  return date.toISOString();
}

/**
 * Get human-readable label for a time window
 */
export function getTimeWindowLabel(window: TimeWindow): string {
  const labels: Record<TimeWindow, string> = {
    day: "Today",
    week: "This Week",
    mtd: "Month to Date",
    qtd: "Quarter to Date",
    ytd: "Year to Date",
    trailing_7: "Last 7 Days",
    trailing_30: "Last 30 Days",
    trailing_90: "Last 90 Days",
  };
  return labels[window];
}

/**
 * Get short label for a time window (for table headers)
 */
export function getTimeWindowShortLabel(window: TimeWindow): string {
  const labels: Record<TimeWindow, string> = {
    day: "D",
    week: "W",
    mtd: "M",
    qtd: "Q",
    ytd: "YTD",
    trailing_7: "7D",
    trailing_30: "30D",
    trailing_90: "90D",
  };
  return labels[window];
}

/**
 * Standard window display order
 */
export const WINDOW_ORDER: TimeWindow[] = [
  "day",
  "week",
  "mtd",
  "qtd",
  "ytd",
  "trailing_7",
  "trailing_30",
  "trailing_90",
];

/**
 * Sort windows by standard display order
 */
export function sortWindows(windows: TimeWindow[]): TimeWindow[] {
  return [...windows].sort(
    (a, b) => WINDOW_ORDER.indexOf(a) - WINDOW_ORDER.indexOf(b)
  );
}
