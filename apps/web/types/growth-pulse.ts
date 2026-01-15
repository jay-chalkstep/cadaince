/**
 * Growth Pulse Types
 *
 * TypeScript interfaces for the HubSpot deal pipeline analytics dashboard.
 */

// Time frame options for the dashboard
export type TimeFrameDays = 7 | 30 | 90 | "qtd" | "custom";

export interface TimeFrameOption {
  label: string;
  value: TimeFrameDays;
}

export const TIME_FRAME_OPTIONS: TimeFrameOption[] = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
  { label: "QTD", value: "qtd" },
  { label: "Custom range", value: "custom" },
];

// Summary metrics for the dashboard
export interface GrowthPulseMetrics {
  totalPipelineArr: number;
  totalPipelineAmount: number;
  totalPipelineGp: number;
  openDeals: number;
  stageChanges: number;
  avgDealSize: number;
  avgDealAgeDays: number | null;
  sellerCount: number;
  // 30-day metrics
  closingNext30DaysGpv: number;
  closingNext30DaysGp: number;
  closingNext30DaysCount: number;
  launchingNext30DaysGpv: number;
  launchingNext30DaysGp: number;
  launchingNext30DaysCount: number;
  totalNumNotes: number;
}

// Pipeline stage breakdown
export interface StageBreakdown {
  stage: string;
  dealCount: number;
  totalArr: number;
  totalAmount: number;
  avgDealSize: number;
  avgDaysInPipeline: number | null;
}

// Closed won trend (daily data)
export interface ClosedWonTrendItem {
  date: string;
  dealCount: number;
  totalArr: number;
  totalAmount: number;
}

// Seller summary for the table
export interface SellerSummary {
  ownerId: string;
  ownerName: string;
  ownerEmail: string | null;
  firstName: string | null;
  lastName: string | null;
  openPipelineArr: number;
  openPipelineAmount: number;
  openDealCount: number;
  closedWonQtdArr: number;
  closedWonQtdCount: number;
  closedWonArr: number;
  closedWonCount: number;
  closedLostCount: number;
  avgOpenDealSize: number;
  avgDealAgeDays: number | null;
}

// Organization benchmarks
export interface OrgBenchmarks {
  avgOpenPipeline: number;
  avgClosedWonQtd: number;
  avgOpenDeals: number;
  avgDealAge: number | null;
  avgDealSize: number;
  leaderClosedWonQtd: number;
  leaderOpenPipeline: number;
  leaderOpenDeals: number;
  totalOpenPipeline: number;
  totalClosedWonQtd: number;
  sellerCount: number;
}

// Seller comparison (vs team avg and leader)
export interface BenchmarkComparison {
  metric: string;
  sellerValue: number;
  teamAvg: number;
  leader: number;
  percentile: number;
}

// Deal summary for tables
export interface DealSummary {
  id: string;
  hubspotDealId: string;
  dealName: string | null;
  amount: number | null;
  arr: number | null;
  gpv: number | null;
  stage: string | null;
  pipeline: string | null;
  dealType: string | null;
  offering: string | null;
  closeDate: string | null;
  createDate: string | null;
  companyName: string | null;
  daysInPipeline: number | null;
  ownerId: string | null;
  ownerName: string | null;
}

// Account activity summary
export interface AccountActivity {
  companyId: string;
  companyName: string;
  dealCount: number;
  totalArr: number;
  activityCount: number;
  lastActivityDate: string | null;
}

// Activity item
export interface ActivityItem {
  id: string;
  activityType: string;
  subject: string | null;
  activityDate: string | null;
  dealId: string | null;
  companyId: string | null;
}

// Seller detail (full data for detail page)
export interface SellerDetail {
  owner: {
    id: string;
    hubspotOwnerId: string;
    name: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  metrics: {
    openPipelineArr: number;
    openDealCount: number;
    closedWonQtdArr: number;
    closedWonQtdCount: number;
    avgDealSize: number;
    avgDealAgeDays: number | null;
  };
  benchmarks: BenchmarkComparison[];
  stageDistribution: StageBreakdown[];
  offeringDistribution: OfferingBreakdown[];
  topDeals: DealSummary[];
  topAccounts: AccountActivity[];
  recentActivities: ActivityItem[];
}

// Offering type breakdown
export interface OfferingBreakdown {
  offering: string;
  dealCount: number;
  totalArr: number;
  percentage: number;
}

// AI-generated insight
export interface GrowthPulseInsight {
  type: "velocity" | "stalled" | "activity" | "coverage" | "funnel";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  recommendation: string;
  dealIds?: string[];
}

// Dashboard filter state
export interface GrowthPulseFilters {
  pipeline?: string;
  ownerId?: string;
  stage?: string;
  offering?: string;
}

// Full metrics response (for dashboard)
export interface GrowthPulseMetricsResponse {
  summary: GrowthPulseMetrics;
  gpvByStage: GpvStageBreakdown[];
  activityBySeller: ActivityBySeller[];
  benchmarks: OrgBenchmarks;
}

// Sellers list response
export interface SellersListResponse {
  sellers: SellerSummary[];
  benchmarks: OrgBenchmarks;
}

// Deals list response
export interface DealsListResponse {
  deals: DealSummary[];
  total: number;
  page: number;
  limit: number;
}

// Sync result types
export interface SyncResult {
  success: boolean;
  syncLogId?: string;
  recordsFetched?: number;
  recordsCreated?: number;
  recordsUpdated?: number;
  stageChangesDetected?: number;
  error?: string;
}

// Utility function for formatting currency
export function formatCurrency(value: number | null, compact = false): string {
  if (value === null || value === undefined) return "—";

  if (compact) {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Utility function for formatting days
export function formatDays(days: number | null): string {
  if (days === null || days === undefined) return "—";

  if (days < 1) {
    return "<1 day";
  }
  if (days === 1) {
    return "1 day";
  }
  return `${Math.round(days)} days`;
}

// Utility function for formatting percent change
export function formatPercentChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

// Utility function to calculate percentile
export function calculatePercentile(
  value: number,
  values: number[]
): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v < value).length;

  return Math.round((rank / sorted.length) * 100);
}

// Sales Pipeline stage mapping (HubSpot ID -> display info)
export const SALES_PIPELINE_ID = "1313294015";

export const SALES_PIPELINE_STAGES: Record<string, { label: string; shortLabel: string; order: number }> = {
  "2137288409": { label: "Qualified Opportunity", shortLabel: "Qualified", order: 1 },
  "2137288410": { label: "Solution Development / Presentation", shortLabel: "Solution Dev", order: 2 },
  "2137288411": { label: "Proposal Development", shortLabel: "Proposal Dev", order: 3 },
  "2137288412": { label: "Proposal Negotiation", shortLabel: "Negotiation", order: 4 },
  "2137288413": { label: "Verbal / Contracting", shortLabel: "Verbal", order: 5 },
};

// Ordered list of stage IDs for the GPV chart
export const SALES_PIPELINE_STAGE_ORDER = [
  "2137288409",
  "2137288410",
  "2137288411",
  "2137288412",
  "2137288413",
];

// GPV by stage breakdown for line charts
export interface GpvStageBreakdown {
  stageId: string;
  stageLabel: string;
  shortLabel: string;
  order: number;
  dealCount: number;
  gpvFullYear: number;
  gpvInCurrentYear: number;
  gpByStage: number;
  gpFullYear: number;
  numNotes: number;
}

// Activity by seller for bar chart
export interface ActivityBySeller {
  ownerId: string;
  ownerName: string;
  numNotes: number;
  dealCount: number;
}

// Stage colors for consistent visualization
export const STAGE_COLORS: Record<string, string> = {
  // Common HubSpot default stages
  appointmentscheduled: "#3B82F6", // blue
  qualifiedtobuy: "#8B5CF6", // violet
  presentationscheduled: "#06B6D4", // cyan
  decisionmakerboughtin: "#10B981", // emerald
  contractsent: "#F59E0B", // amber
  closedwon: "#22C55E", // green
  closedlost: "#EF4444", // red
  // Fallback
  default: "#6B7280", // gray
};

// Get color for a stage
export function getStageColor(stage: string): string {
  const normalized = stage.toLowerCase().replace(/[^a-z]/g, "");
  return STAGE_COLORS[normalized] || STAGE_COLORS.default;
}

// Activity type icons (for reference in UI)
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  calls: "Call",
  emails: "Email",
  meetings: "Meeting",
  notes: "Note",
  tasks: "Task",
};
