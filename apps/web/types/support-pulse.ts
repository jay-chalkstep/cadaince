// Time frame options for the dashboard
export type TimeFrameDays = 7 | 10 | 30 | 90 | "custom";

export interface TimeFrameOption {
  label: string;
  value: TimeFrameDays;
}

export const TIME_FRAME_OPTIONS: TimeFrameOption[] = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 10 days", value: 10 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
  { label: "Custom range", value: "custom" },
];

// Ticket properties from HubSpot (from integration_records.properties JSONB)
export interface TicketProperties {
  content: string | null;
  subject: string | null;
  ticket_category: string | null;
  source_type: string | null;
  hs_is_closed: "true" | "false";
  closed_date: string | null;
  time_to_close: string | null;
  time_to_first_agent_reply: string | null;
  hubspot_owner_id: string | null;
  hs_pipeline_stage: string | null;
  hs_ticket_priority: string | null;
  program_name: string | null;
  client_name: string | null;
  createdate: string | null;
}

// Integration record with ticket type
export interface TicketRecord {
  id: string;
  external_id: string;
  properties: TicketProperties;
  external_created_at: string;
  synced_at: string;
}

// Summary metrics
export interface SupportMetrics {
  totalTickets: number;
  totalTicketsPrevious: number;
  percentChange: number;
  avgTimeToClose: number | null;
  avgTimeToClosePrevious: number | null;
  avgTimeToCloseChange: number;
  avgFirstResponse: number | null;
  avgFirstResponsePrevious: number | null;
  avgFirstResponseChange: number;
  openTickets: number;
}

// Chart data types
export interface DailyVolume {
  date: string;
  count: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
}

export interface SourceMix {
  source: string;
  count: number;
  percentage: number;
}

export interface ResolutionBucket {
  bucket: string;
  count: number;
  percentage: number;
}

export interface OwnerWorkload {
  ownerId: string;
  ownerName: string | null;
  ticketCount: number;
  avgResolutionMs: number | null;
  openCount: number;
}

export interface ClientVolume {
  clientName: string;
  programName: string | null;
  ticketCount: number;
}

// Filter state
export interface SupportPulseFilters {
  category?: string;
  source?: string;
  ownerId?: string;
  clientName?: string;
  programName?: string;
}

// Full metrics response
export interface SupportMetricsResponse {
  summary: SupportMetrics;
  dailyVolume: DailyVolume[];
  categoryBreakdown: CategoryBreakdown[];
  sourceMix: SourceMix[];
  resolutionDistribution: ResolutionBucket[];
  ownerWorkload: OwnerWorkload[];
  clientVolume: ClientVolume[];
}

// Ticket list item for drill-down
export interface TicketListItem {
  id: string;
  externalId: string;
  subject: string | null;
  category: string | null;
  source: string | null;
  status: "open" | "closed";
  createdAt: string;
  timeToClose: number | null;
  content: string | null;
  clientName: string | null;
  programName: string | null;
  ownerId: string | null;
  ownerName: string | null;
}

// Tickets list response
export interface TicketsListResponse {
  tickets: TicketListItem[];
  total: number;
  page: number;
  limit: number;
}

// Utility function for formatting duration
export function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";

  const hours = ms / (1000 * 60 * 60);
  const days = hours / 24;

  if (days >= 1) {
    return `${days.toFixed(1)}d`;
  }
  if (hours >= 1) {
    return `${hours.toFixed(1)}h`;
  }
  return `${Math.round(ms / (1000 * 60))}m`;
}

// Utility function for formatting percent change
export function formatPercentChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

// Feedback metrics for score card
export interface FeedbackMetrics {
  currentScore: number | null;
  previousScore: number | null;
  surveyCount: number;
  trend: "up" | "down" | "neutral";
}

// Owner detail data for modal
export interface OwnerDetail {
  owner: {
    id: string;
    name: string | null;
  };
  metrics: {
    totalTickets: number;
    openTickets: number;
    avgResolutionMs: number | null;
    avgFeedbackScore: number | null;
    surveyCount: number;
  };
  feedback: OwnerFeedbackItem[];
}

export interface OwnerFeedbackItem {
  submittedAt: string;
  score: number;
  ticketSubject: string;
  sentiment: string | null;
}
