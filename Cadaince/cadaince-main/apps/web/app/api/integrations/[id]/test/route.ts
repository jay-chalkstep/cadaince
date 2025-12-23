import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/integrations/[id]/test - Test connection for an integration
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  // Get the integration
  const { data: integration, error: integrationError } = await supabase
    .from("integrations")
    .select("*")
    .eq("id", id)
    .single();

  if (integrationError || !integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  try {
    let testResult: { success: boolean; message: string; details?: Record<string, unknown> };

    switch (integration.type) {
      case "hubspot":
        testResult = await testHubSpotConnection(integration.config);
        break;
      case "bigquery":
        testResult = await testBigQueryConnection(integration.config);
        break;
      default:
        testResult = { success: false, message: `Unsupported integration type: ${integration.type}` };
    }

    // Update last_error if test failed
    if (!testResult.success) {
      await supabase
        .from("integrations")
        .update({ last_error: testResult.message })
        .eq("id", id);
    } else {
      // Clear last_error and mark credentials as set if successful
      await supabase
        .from("integrations")
        .update({ last_error: null, credentials_set: true })
        .eq("id", id);
    }

    return NextResponse.json(testResult);
  } catch (error) {
    console.error("Error testing integration:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update last_error
    await supabase
      .from("integrations")
      .update({ last_error: errorMessage })
      .eq("id", id);

    return NextResponse.json({
      success: false,
      message: "Failed to test connection",
      error: errorMessage,
    }, { status: 500 });
  }
}

async function testHubSpotConnection(config: Record<string, unknown>): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!accessToken) {
    return {
      success: false,
      message: "HubSpot access token not configured. Set HUBSPOT_ACCESS_TOKEN environment variable.",
    };
  }

  try {
    // Test API access by fetching account info
    const response = await fetch("https://api.hubapi.com/account-info/v3/api-usage/daily/private-apps", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `HubSpot API error: ${response.status} - ${errorData.message || response.statusText}`,
      };
    }

    // Test deals access
    const dealsResponse = await fetch("https://api.hubapi.com/crm/v3/objects/deals?limit=1", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const scopes: string[] = [];
    if (dealsResponse.ok) scopes.push("crm.objects.deals.read");

    // Test contacts access
    const contactsResponse = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (contactsResponse.ok) scopes.push("crm.objects.contacts.read");

    // Test tickets access
    const ticketsResponse = await fetch("https://api.hubapi.com/crm/v3/objects/tickets?limit=1", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (ticketsResponse.ok) scopes.push("tickets");

    return {
      success: true,
      message: "HubSpot connection successful",
      details: {
        portal_id: config.portal_id || "Not configured",
        available_scopes: scopes,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to connect to HubSpot: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function testBigQueryConnection(config: Record<string, unknown>): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
  const projectId = config.project_id as string;
  const dataset = config.dataset as string;
  const serviceAccountKey = process.env.BIGQUERY_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    return {
      success: false,
      message: "BigQuery service account key not configured. Set BIGQUERY_SERVICE_ACCOUNT_KEY environment variable.",
    };
  }

  if (!projectId) {
    return {
      success: false,
      message: "BigQuery project_id not configured in integration settings.",
    };
  }

  try {
    // Parse service account key
    const credentials = JSON.parse(serviceAccountKey);

    // For now, we'll do a basic validation of the credentials structure
    if (!credentials.client_email || !credentials.private_key) {
      return {
        success: false,
        message: "Invalid service account key: missing client_email or private_key",
      };
    }

    // In a production environment, you would use the Google BigQuery client library
    // For now, we validate the configuration
    return {
      success: true,
      message: "BigQuery configuration validated",
      details: {
        project_id: projectId,
        dataset: dataset || "Not configured",
        service_account: credentials.client_email,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to validate BigQuery configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
