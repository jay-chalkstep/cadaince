import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getOwnerNamesMap } from "@/lib/integrations/hubspot/sync-owners";
import type {
  SupportMetricsResponse,
  DailyVolume,
  CategoryBreakdown,
  SourceMix,
  ResolutionBucket,
  OwnerWorkload,
  ClientVolume,
} from "@/types/support-pulse";

// Resolution bucket thresholds in milliseconds
const BUCKET_THRESHOLDS = {
  ONE_HOUR: 3600000,
  FOUR_HOURS: 14400000,
  ONE_DAY: 86400000,
  THREE_DAYS: 259200000,
};

function calculatePercentChange(current: number | null, previous: number | null): number {
  if (previous === null || previous === 0 || current === null) return 0;
  return ((current - previous) / previous) * 100;
}

// GET /api/support/metrics
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "10");
  const customStart = searchParams.get("start_date");
  const customEnd = searchParams.get("end_date");

  // Filters
  const category = searchParams.get("category");
  const source = searchParams.get("source");
  const ownerId = searchParams.get("owner_id");
  const clientName = searchParams.get("client_name");

  // Calculate date ranges
  const now = new Date();
  let endDate = now;
  let startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  if (customStart && customEnd) {
    startDate = new Date(customStart);
    endDate = new Date(customEnd);
  }

  // Previous period for comparison
  const periodLength = endDate.getTime() - startDate.getTime();
  const previousEnd = new Date(startDate.getTime());
  const previousStart = new Date(startDate.getTime() - periodLength);

  // Fetch all tickets with pagination (Supabase has 1000 row default limit)
  const fetchAllTickets = async (start: Date, end: Date): Promise<TicketData[]> => {
    const allTickets: TicketData[] = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("integration_records")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .eq("object_type", "tickets")
        .gte("external_created_at", start.toISOString())
        .lt("external_created_at", end.toISOString())
        .order("external_created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (category) {
        query = query.eq("properties->>ticket_category", category);
      }
      if (source) {
        query = query.eq("properties->>source_type", source);
      }
      if (ownerId) {
        query = query.eq("properties->>hubspot_owner_id", ownerId);
      }
      if (clientName) {
        query = query.eq("properties->>client_name", clientName);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching tickets page:", error);
        break;
      }

      if (data && data.length > 0) {
        allTickets.push(...(data as TicketData[]));
        offset += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allTickets;
  };

  try {
    // Fetch current period, previous period, and all open tickets in parallel
    const [currentTickets, previousTickets, openTicketsResult] = await Promise.all([
      fetchAllTickets(startDate, endDate),
      fetchAllTickets(previousStart, previousEnd),
      // Open tickets query - NO date filter, just currently open tickets
      supabase
        .from("integration_records")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("object_type", "tickets")
        .eq("properties->>hs_is_closed", "false"),
    ]);

    const totalOpenTickets = openTicketsResult.count || 0;

    // Calculate summary metrics
    const currentMetrics = calculateSummaryMetrics(currentTickets);
    const previousMetrics = calculateSummaryMetrics(previousTickets);

    const summary = {
      totalTickets: currentMetrics.total,
      totalTicketsPrevious: previousMetrics.total,
      percentChange: calculatePercentChange(currentMetrics.total, previousMetrics.total),
      avgTimeToClose: currentMetrics.avgTimeToClose,
      avgTimeToClosePrevious: previousMetrics.avgTimeToClose,
      avgTimeToCloseChange: calculatePercentChange(
        currentMetrics.avgTimeToClose,
        previousMetrics.avgTimeToClose
      ),
      avgFirstResponse: currentMetrics.avgFirstResponse,
      avgFirstResponsePrevious: previousMetrics.avgFirstResponse,
      avgFirstResponseChange: calculatePercentChange(
        currentMetrics.avgFirstResponse,
        previousMetrics.avgFirstResponse
      ),
      openTickets: totalOpenTickets, // Use time-independent count
    };

    // Calculate breakdowns
    const dailyVolume = calculateDailyVolume(currentTickets, startDate, endDate);
    const categoryBreakdown = calculateCategoryBreakdown(currentTickets);
    const sourceMix = calculateSourceMix(currentTickets);
    const resolutionDistribution = calculateResolutionDistribution(currentTickets);
    const ownerWorkloadRaw = calculateOwnerWorkload(currentTickets);
    const clientVolume = calculateClientVolume(currentTickets);

    // Fetch owner names for the owner workload
    const ownerIds = ownerWorkloadRaw.map((o) => o.ownerId);
    const ownerNamesMap = await getOwnerNamesMap(profile.organization_id, ownerIds);

    // Add owner names to workload
    const ownerWorkload: OwnerWorkload[] = ownerWorkloadRaw.map((o) => ({
      ...o,
      ownerName: ownerNamesMap.get(o.ownerId) || null,
    }));

    const response: SupportMetricsResponse = {
      summary,
      dailyVolume,
      categoryBreakdown,
      sourceMix,
      resolutionDistribution,
      ownerWorkload,
      clientVolume,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching support metrics:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}

interface TicketData {
  id: string;
  properties: Record<string, unknown>;
  external_created_at: string;
}

function calculateSummaryMetrics(tickets: TicketData[]) {
  let total = tickets.length;
  let openCount = 0;
  let totalTimeToClose = 0;
  let timeToCloseCount = 0;
  let totalFirstResponse = 0;
  let firstResponseCount = 0;

  for (const ticket of tickets) {
    const props = ticket.properties;

    // Count open tickets
    if (props.hs_is_closed === "false") {
      openCount++;
    }

    // Sum time to close
    const timeToClose = props.time_to_close;
    if (timeToClose && typeof timeToClose === "string" && timeToClose !== "") {
      const ms = parseInt(timeToClose, 10);
      if (!isNaN(ms) && ms > 0) {
        totalTimeToClose += ms;
        timeToCloseCount++;
      }
    }

    // Sum first response time
    const firstResponse = props.time_to_first_agent_reply;
    if (firstResponse && typeof firstResponse === "string" && firstResponse !== "") {
      const ms = parseInt(firstResponse, 10);
      if (!isNaN(ms) && ms > 0) {
        totalFirstResponse += ms;
        firstResponseCount++;
      }
    }
  }

  return {
    total,
    openCount,
    avgTimeToClose: timeToCloseCount > 0 ? Math.round(totalTimeToClose / timeToCloseCount) : null,
    avgFirstResponse: firstResponseCount > 0 ? Math.round(totalFirstResponse / firstResponseCount) : null,
  };
}

function calculateDailyVolume(tickets: TicketData[], startDate: Date, endDate: Date): DailyVolume[] {
  const volumeMap = new Map<string, number>();

  // Initialize all days in range with 0
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().split("T")[0];
    volumeMap.set(dateStr, 0);
    current.setDate(current.getDate() + 1);
  }

  // Count tickets per day
  for (const ticket of tickets) {
    const dateStr = ticket.external_created_at.split("T")[0];
    volumeMap.set(dateStr, (volumeMap.get(dateStr) || 0) + 1);
  }

  // Convert to sorted array
  return Array.from(volumeMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function calculateCategoryBreakdown(tickets: TicketData[]): CategoryBreakdown[] {
  const categoryMap = new Map<string, number>();

  for (const ticket of tickets) {
    const category = (ticket.properties.ticket_category as string) || "Uncategorized";
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
  }

  const total = tickets.length;
  return Array.from(categoryMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => ({
      category,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
}

function calculateSourceMix(tickets: TicketData[]): SourceMix[] {
  const sourceMap = new Map<string, number>();

  for (const ticket of tickets) {
    const source = (ticket.properties.source_type as string) || "Unknown";
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  }

  const total = tickets.length;
  return Array.from(sourceMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([source, count]) => ({
      source,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
}

function calculateResolutionDistribution(tickets: TicketData[]): ResolutionBucket[] {
  const buckets = {
    "< 1 hr": 0,
    "1-4 hr": 0,
    "4-24 hr": 0,
    "1-3 days": 0,
    "3+ days": 0,
  };

  let closedCount = 0;

  for (const ticket of tickets) {
    const props = ticket.properties;
    if (props.hs_is_closed !== "true") continue;

    const timeToClose = props.time_to_close;
    if (!timeToClose || typeof timeToClose !== "string" || timeToClose === "") continue;

    const ms = parseInt(timeToClose, 10);
    if (isNaN(ms) || ms <= 0) continue;

    closedCount++;

    if (ms < BUCKET_THRESHOLDS.ONE_HOUR) {
      buckets["< 1 hr"]++;
    } else if (ms < BUCKET_THRESHOLDS.FOUR_HOURS) {
      buckets["1-4 hr"]++;
    } else if (ms < BUCKET_THRESHOLDS.ONE_DAY) {
      buckets["4-24 hr"]++;
    } else if (ms < BUCKET_THRESHOLDS.THREE_DAYS) {
      buckets["1-3 days"]++;
    } else {
      buckets["3+ days"]++;
    }
  }

  return Object.entries(buckets).map(([bucket, count]) => ({
    bucket,
    count,
    percentage: closedCount > 0 ? Math.round((count / closedCount) * 100) : 0,
  }));
}

function calculateOwnerWorkload(tickets: TicketData[]): Omit<OwnerWorkload, "ownerName">[] {
  const ownerMap = new Map<
    string,
    { count: number; totalResolution: number; resolutionCount: number; openCount: number }
  >();

  for (const ticket of tickets) {
    const props = ticket.properties;
    const ownerId = props.hubspot_owner_id as string;
    if (!ownerId) continue;

    const current = ownerMap.get(ownerId) || {
      count: 0,
      totalResolution: 0,
      resolutionCount: 0,
      openCount: 0,
    };

    current.count++;

    if (props.hs_is_closed === "false") {
      current.openCount++;
    }

    const timeToClose = props.time_to_close;
    if (timeToClose && typeof timeToClose === "string" && timeToClose !== "") {
      const ms = parseInt(timeToClose, 10);
      if (!isNaN(ms) && ms > 0) {
        current.totalResolution += ms;
        current.resolutionCount++;
      }
    }

    ownerMap.set(ownerId, current);
  }

  return Array.from(ownerMap.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([ownerId, data]) => ({
      ownerId,
      ticketCount: data.count,
      avgResolutionMs:
        data.resolutionCount > 0 ? Math.round(data.totalResolution / data.resolutionCount) : null,
      openCount: data.openCount,
    }));
}

function calculateClientVolume(tickets: TicketData[]): ClientVolume[] {
  const clientMap = new Map<string, { programName: string | null; count: number }>();

  for (const ticket of tickets) {
    const props = ticket.properties;
    const clientName = (props.client_name as string) || "Unknown";
    const programName = props.program_name as string | null;

    const key = `${clientName}::${programName || ""}`;
    const current = clientMap.get(key) || { programName, count: 0 };
    current.count++;
    clientMap.set(key, current);
  }

  return Array.from(clientMap.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 20)
    .map(([key, data]) => {
      const [clientName] = key.split("::");
      return {
        clientName,
        programName: data.programName,
        ticketCount: data.count,
      };
    });
}
