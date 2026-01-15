import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getOwnerNamesMap } from "@/lib/integrations/hubspot/sync-owners";
import type { TicketListItem, TicketsListResponse } from "@/types/support-pulse";

// GET /api/support/tickets - Get paginated ticket list for drill-down
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
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
  const search = searchParams.get("search");

  // Filters
  const category = searchParams.get("category");
  const source = searchParams.get("source");
  const ownerId = searchParams.get("owner_id");
  const clientName = searchParams.get("client_name");

  // Fetch org settings to get excluded owners
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", profile.organization_id)
    .single();

  const orgSettings = org?.settings as Record<string, unknown> | null;
  const pulseSettings = orgSettings?.pulse_settings as { customer_pulse_excluded_owners?: string[] } | undefined;
  const excludedOwners = pulseSettings?.customer_pulse_excluded_owners || [];

  // Calculate date range
  const now = new Date();
  let endDate = now;
  let startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  if (customStart && customEnd) {
    startDate = new Date(customStart);
    endDate = new Date(customEnd);
  }

  try {
    // Build query
    let query = supabase
      .from("integration_records")
      .select("*", { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .eq("object_type", "tickets")
      .gte("external_created_at", startDate.toISOString())
      .lt("external_created_at", endDate.toISOString())
      .order("external_created_at", { ascending: false });

    // Apply filters
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
    if (search) {
      query = query.or(`properties->>subject.ilike.%${search}%,properties->>content.ilike.%${search}%`);
    }
    // Apply owner exclusion filter
    if (excludedOwners.length > 0) {
      for (const excludedId of excludedOwners) {
        query = query.neq("properties->>hubspot_owner_id", excludedId);
      }
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: tickets, error, count } = await query;

    if (error) {
      console.error("Error fetching tickets:", error);
      return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
    }

    // Collect unique owner IDs for name lookup
    const ownerIds = new Set<string>();
    for (const ticket of tickets || []) {
      const props = ticket.properties as Record<string, unknown>;
      const ownerId = props.hubspot_owner_id as string;
      if (ownerId) {
        ownerIds.add(ownerId);
      }
    }

    // Fetch owner names
    const ownerNamesMap = await getOwnerNamesMap(
      profile.organization_id,
      Array.from(ownerIds)
    );

    // Transform tickets to list items
    const ticketItems: TicketListItem[] = (tickets || []).map((ticket) => {
      const props = ticket.properties as Record<string, unknown>;
      const timeToClose = props.time_to_close;
      let timeToCloseMs: number | null = null;

      if (timeToClose && typeof timeToClose === "string" && timeToClose !== "") {
        const parsed = parseInt(timeToClose, 10);
        if (!isNaN(parsed) && parsed > 0) {
          timeToCloseMs = parsed;
        }
      }

      const ownerId = (props.hubspot_owner_id as string) || null;

      return {
        id: ticket.id,
        externalId: ticket.external_id,
        subject: (props.subject as string) || null,
        category: (props.ticket_category as string) || null,
        source: (props.source_type as string) || null,
        status: props.hs_is_closed === "true" ? "closed" : "open",
        createdAt: ticket.external_created_at,
        timeToClose: timeToCloseMs,
        content: (props.content as string) || null,
        clientName: (props.client_name as string) || null,
        programName: (props.program_name as string) || null,
        ownerId,
        ownerName: ownerId ? ownerNamesMap.get(ownerId) || null : null,
      };
    });

    const response: TicketsListResponse = {
      tickets: ticketItems,
      total: count || 0,
      page,
      limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}
