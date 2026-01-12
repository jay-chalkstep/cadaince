import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { HubSpotClient } from "@/lib/integrations/providers/hubspot";

/**
 * GET /api/data-sources/[id]/debug-associations
 * Debug endpoint to test HubSpot associations API
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: dataSourceId } = await params;
  const supabase = createAdminClient();

  // Get the data source with integration
  const { data: dataSource, error: fetchError } = await supabase
    .from("data_sources_v2")
    .select(`
      *,
      integration:integrations_v2(id, provider, status)
    `)
    .eq("id", dataSourceId)
    .single();

  if (fetchError || !dataSource) {
    return NextResponse.json({ error: "Data source not found" }, { status: 404 });
  }

  const integration = dataSource.integration as {
    id: string;
    provider: string;
    status: string;
  };

  if (!integration || integration.provider !== "hubspot") {
    return NextResponse.json({ error: "Not a HubSpot data source" }, { status: 400 });
  }

  // Get HubSpot client
  const client = await HubSpotClient.forIntegration(integration.id);
  if (!client) {
    return NextResponse.json({ error: "Failed to initialize HubSpot client" }, { status: 500 });
  }

  // Get a few feedback submission IDs to test
  const { data: feedbackRecords, error: recordsError } = await supabase
    .from("integration_records")
    .select("external_id, properties")
    .eq("data_source_id", dataSourceId)
    .limit(5);

  if (recordsError || !feedbackRecords?.length) {
    return NextResponse.json({
      error: "No feedback records found",
      details: recordsError?.message
    }, { status: 404 });
  }

  // Test batch associations
  const feedbackIds = feedbackRecords.map(r => r.external_id);
  console.log(`[Debug] Testing associations for ${feedbackIds.length} feedback IDs:`, feedbackIds);

  try {
    // First, check what association types exist between feedback_submissions and tickets
    const associationSchema = await client.getAssociationSchema(
      "feedback_submissions",
      "tickets"
    );

    const reverseSchema = await client.getAssociationSchema(
      "tickets",
      "feedback_submissions"
    );

    // Test batch API
    const batchAssociations = await client.batchFetchAssociations(
      "feedback_submissions",
      feedbackIds,
      "tickets"
    );

    // Also test individual API for first record
    const singleAssociations = await client.fetchAssociations(
      "feedback_submissions",
      feedbackIds[0],
      "tickets"
    );

    // Try reverse direction too (tickets -> feedback)
    let reverseTest = null;
    try {
      // Get a ticket ID to test reverse lookup
      const { data: ticketRecords } = await supabase
        .from("integration_records")
        .select("external_id")
        .eq("object_type", "tickets")
        .limit(1);

      if (ticketRecords?.[0]) {
        const ticketAssoc = await client.fetchAssociations(
          "tickets",
          ticketRecords[0].external_id,
          "feedback_submissions"
        );
        reverseTest = {
          ticket_id: ticketRecords[0].external_id,
          feedback_ids: ticketAssoc
        };
      }
    } catch (e) {
      reverseTest = { error: String(e) };
    }

    return NextResponse.json({
      success: true,
      association_schema: {
        feedback_to_tickets: associationSchema,
        tickets_to_feedback: reverseSchema,
        note: "If empty, no association type exists between these objects"
      },
      feedback_ids_tested: feedbackIds,
      batch_associations: Object.fromEntries(batchAssociations),
      single_associations: {
        feedback_id: feedbackIds[0],
        ticket_ids: singleAssociations
      },
      reverse_lookup: reverseTest,
      sample_feedback_properties: feedbackRecords.map(r => ({
        external_id: r.external_id,
        hs_ticket_id: (r.properties as Record<string, unknown>)?.hs_ticket_id,
        hs_ticket_subject: (r.properties as Record<string, unknown>)?.hs_ticket_subject,
        associated_ticket_id: (r.properties as Record<string, unknown>)?.associated_ticket_id,
      }))
    });
  } catch (error) {
    console.error("[Debug] Associations test error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      feedback_ids_tested: feedbackIds
    }, { status: 500 });
  }
}
