import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { OwnerDetail, OwnerFeedbackItem } from "@/types/support-pulse";

const SCORE_FIELD = "how_satisfied_are_you_with_the_resolution_of_your_issue_";

interface TicketRecord {
  external_id: string;
  properties: Record<string, unknown>;
}

interface FeedbackRecord {
  properties: Record<string, unknown>;
}

interface OwnerRecord {
  external_id: string;
  properties: Record<string, unknown>;
}

// GET /api/support/owner/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: ownerId } = await params;

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

  // Calculate date ranges
  const now = new Date();
  let endDate = now;
  let startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  if (customStart && customEnd) {
    startDate = new Date(customStart);
    endDate = new Date(customEnd);
  }

  try {
    // Fetch owner info, tickets, and feedback in parallel
    const [ownerResult, ticketsResult] = await Promise.all([
      // Get owner name from owners object
      supabase
        .from("integration_records")
        .select("external_id, properties")
        .eq("organization_id", profile.organization_id)
        .eq("object_type", "owners")
        .eq("external_id", ownerId)
        .single(),
      // Get tickets for this owner in date range
      supabase
        .from("integration_records")
        .select("external_id, properties")
        .eq("organization_id", profile.organization_id)
        .eq("object_type", "tickets")
        .eq("properties->>hubspot_owner_id", ownerId)
        .gte("external_created_at", startDate.toISOString())
        .lt("external_created_at", endDate.toISOString()),
    ]);

    // Get owner name
    let ownerName: string | null = null;
    if (ownerResult.data) {
      const ownerData = ownerResult.data as OwnerRecord;
      const firstName = ownerData.properties?.firstName as string || "";
      const lastName = ownerData.properties?.lastName as string || "";
      ownerName = [firstName, lastName].filter(Boolean).join(" ") || null;
    }

    const tickets = (ticketsResult.data || []) as TicketRecord[];

    // Calculate ticket metrics
    let totalTickets = tickets.length;
    let openTickets = 0;
    let totalResolution = 0;
    let resolutionCount = 0;
    const contactIds: string[] = [];

    for (const ticket of tickets) {
      const props = ticket.properties;

      // Count open tickets
      if (props.hs_is_closed === "false") {
        openTickets++;
      }

      // Sum resolution times
      const timeToClose = props.time_to_close;
      if (timeToClose && typeof timeToClose === "string" && timeToClose !== "") {
        const ms = parseInt(timeToClose, 10);
        if (!isNaN(ms) && ms > 0) {
          totalResolution += ms;
          resolutionCount++;
        }
      }

      // Collect contact IDs for feedback lookup
      const contactId = props.associated_contacts_id as string;
      if (contactId) {
        contactIds.push(contactId);
      }
    }

    const avgResolutionMs = resolutionCount > 0 ? Math.round(totalResolution / resolutionCount) : null;

    // Now fetch feedback for these contacts
    let feedbackItems: OwnerFeedbackItem[] = [];
    let avgFeedbackScore: number | null = null;
    let surveyCount = 0;

    if (contactIds.length > 0) {
      // Get unique contact IDs
      const uniqueContactIds = [...new Set(contactIds)];

      // Fetch feedback submissions linked to these contacts
      const feedbackResult = await supabase
        .from("integration_records")
        .select("properties")
        .eq("organization_id", profile.organization_id)
        .eq("object_type", "feedback_submissions")
        .in("properties->>hs_contact_id", uniqueContactIds);

      const feedbackRecords = (feedbackResult.data || []) as FeedbackRecord[];

      // Build a map of contact_id to ticket subject for joining
      const contactToTicket = new Map<string, string>();
      for (const ticket of tickets) {
        const contactId = ticket.properties.associated_contacts_id as string;
        if (contactId) {
          const subject = (ticket.properties.subject as string) || "No subject";
          contactToTicket.set(contactId, subject);
        }
      }

      // Process feedback records
      let totalScore = 0;
      let scoreCount = 0;

      for (const record of feedbackRecords) {
        const props = record.properties;
        const scoreValue = props[SCORE_FIELD];

        // Only include records with valid scores
        if (scoreValue === null || scoreValue === undefined || scoreValue === "") {
          continue;
        }

        const score = parseFloat(String(scoreValue));
        if (isNaN(score) || score < 1 || score > 10) {
          continue;
        }

        totalScore += score;
        scoreCount++;

        const contactId = props.hs_contact_id as string;
        const ticketSubject = contactToTicket.get(contactId) || "Unknown ticket";

        feedbackItems.push({
          submittedAt: (props.hs_submission_timestamp as string) || "",
          score,
          ticketSubject: ticketSubject.substring(0, 50),
          sentiment: (props.hs_sentiment as string) || null,
        });
      }

      surveyCount = scoreCount;
      avgFeedbackScore = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : null;

      // Sort feedback by date descending
      feedbackItems.sort((a, b) => {
        const dateA = new Date(a.submittedAt).getTime();
        const dateB = new Date(b.submittedAt).getTime();
        return dateB - dateA;
      });
    }

    const response: OwnerDetail = {
      owner: {
        id: ownerId,
        name: ownerName,
      },
      metrics: {
        totalTickets,
        openTickets,
        avgResolutionMs,
        avgFeedbackScore,
        surveyCount,
      },
      feedback: feedbackItems,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching owner detail:", error);
    return NextResponse.json({ error: "Failed to fetch owner detail" }, { status: 500 });
  }
}
