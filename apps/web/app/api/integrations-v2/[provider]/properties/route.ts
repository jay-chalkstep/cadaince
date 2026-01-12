/**
 * GET /api/integrations-v2/[provider]/properties
 *
 * Get available properties for a provider's object type.
 * Query params:
 *   - object: The object type (e.g., "deals", "contacts", "tickets")
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { HubSpotClient, type HubSpotObject } from "@/lib/integrations/providers/hubspot";

interface RouteParams {
  params: Promise<{ provider: string }>;
}

const SUPPORTED_PROVIDERS = ["hubspot"];

const HUBSPOT_OBJECTS: HubSpotObject[] = [
  "deals",
  "contacts",
  "companies",
  "tickets",
  "feedback_submissions",
  "line_items",
  "products",
];

export async function GET(req: Request, { params }: RouteParams) {
  const { provider } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: `Properties not supported for ${provider}` },
      { status: 400 }
    );
  }

  // Get object type from query params
  const url = new URL(req.url);
  const object = url.searchParams.get("object");

  if (!object) {
    return NextResponse.json(
      { error: "Missing 'object' query parameter" },
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

  // Fetch properties based on provider
  switch (provider) {
    case "hubspot": {
      if (!HUBSPOT_OBJECTS.includes(object as HubSpotObject)) {
        return NextResponse.json(
          { error: `Invalid object type: ${object}`, validObjects: HUBSPOT_OBJECTS },
          { status: 400 }
        );
      }

      const client = await HubSpotClient.forIntegration(integration.id);
      if (!client) {
        return NextResponse.json(
          { error: "Failed to initialize HubSpot client" },
          { status: 500 }
        );
      }

      const properties = await client.getObjectProperties(object as HubSpotObject);

      // Group properties by groupName for better organization
      const groups: Record<string, typeof properties> = {};
      for (const prop of properties) {
        const group = prop.groupName || "Other";
        if (!groups[group]) groups[group] = [];
        groups[group].push(prop);
      }

      return NextResponse.json({
        object,
        properties,
        groups,
        totalCount: properties.length,
      });
    }

    default:
      return NextResponse.json(
        { error: "Provider not implemented" },
        { status: 501 }
      );
  }
}
