/**
 * POST /api/integrations-v2/[provider]/test
 *
 * Test connection to an integration.
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { HubSpotClient } from "@/lib/integrations/providers/hubspot";

interface RouteParams {
  params: Promise<{ provider: string }>;
}

const TESTABLE_PROVIDERS = ["hubspot", "salesforce", "gong", "salesloft"];

export async function POST(req: Request, { params }: RouteParams) {
  const { provider } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!TESTABLE_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: `Testing not supported for ${provider}` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Get user's profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 403 }
    );
  }

  // Get integration
  const { data: integration, error: findError } = await supabase
    .from("integrations_v2")
    .select("id, status")
    .eq("organization_id", profile.organization_id)
    .eq("provider", provider)
    .single();

  if (findError || !integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  if (integration.status !== "active") {
    return NextResponse.json(
      { error: "Integration not active", status: integration.status },
      { status: 400 }
    );
  }

  // Test connection based on provider
  let testResult: { success: boolean; error?: string; details?: unknown };

  switch (provider) {
    case "hubspot": {
      const client = await HubSpotClient.forIntegration(integration.id);
      if (!client) {
        testResult = { success: false, error: "Failed to initialize client" };
      } else {
        const connTest = await client.testConnection();
        const accountInfo = connTest.success
          ? await client.getAccountInfo()
          : null;
        testResult = {
          success: connTest.success,
          error: connTest.error,
          details: accountInfo,
        };
      }
      break;
    }
    default:
      testResult = { success: false, error: "Provider not implemented" };
  }

  // Update integration status based on test
  if (testResult.success) {
    await supabase
      .from("integrations_v2")
      .update({
        last_successful_connection_at: new Date().toISOString(),
        last_error: null,
        last_error_at: null,
      })
      .eq("id", integration.id);
  } else {
    await supabase
      .from("integrations_v2")
      .update({
        last_error: testResult.error,
        last_error_at: new Date().toISOString(),
      })
      .eq("id", integration.id);
  }

  return NextResponse.json(testResult);
}
