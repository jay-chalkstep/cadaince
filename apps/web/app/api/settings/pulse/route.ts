import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface PulseSettings {
  growth_pulse_excluded_owners: string[];
  customer_pulse_excluded_owners: string[];
}

interface OwnerWithStats {
  hubspot_owner_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  is_active: boolean;
  deal_count: number;
  ticket_count: number;
}

// GET /api/settings/pulse - Get all HubSpot owners and current pulse settings
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's organization and access level
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Require admin access
  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const organizationId = profile.organization_id;

  try {
    // Fetch org settings and owners in parallel
    const [orgResult, ownersResult] = await Promise.all([
      supabase
        .from("organizations")
        .select("settings")
        .eq("id", organizationId)
        .single(),

      // Get owners with deal counts
      supabase.rpc("get_owners_with_stats", { org_id: organizationId }),
    ]);

    // If RPC doesn't exist, fall back to manual query
    let owners: OwnerWithStats[] = [];
    if (ownersResult.error) {
      // Manual query for owners with deal counts
      const { data: ownersData } = await supabase
        .from("hubspot_owners")
        .select("hubspot_owner_id, first_name, last_name, email, is_active")
        .eq("organization_id", organizationId)
        .order("first_name");

      // Get deal counts per owner
      const { data: dealCounts } = await supabase
        .from("hubspot_deals")
        .select("owner_id")
        .eq("organization_id", organizationId);

      const dealCountMap = new Map<string, number>();
      for (const deal of dealCounts || []) {
        if (deal.owner_id) {
          dealCountMap.set(deal.owner_id, (dealCountMap.get(deal.owner_id) || 0) + 1);
        }
      }

      owners = (ownersData || []).map((o) => ({
        ...o,
        deal_count: dealCountMap.get(o.hubspot_owner_id) || 0,
        ticket_count: 0, // TODO: Add ticket count when Customer Pulse is implemented
      }));
    } else {
      owners = ownersResult.data || [];
    }

    // Sort by deal count descending
    owners.sort((a, b) => b.deal_count - a.deal_count);

    // Extract pulse settings from org settings
    const orgSettings = orgResult.data?.settings as Record<string, unknown> | null;
    const pulseSettings: PulseSettings = {
      growth_pulse_excluded_owners: (orgSettings?.pulse_settings as PulseSettings)?.growth_pulse_excluded_owners || [],
      customer_pulse_excluded_owners: (orgSettings?.pulse_settings as PulseSettings)?.customer_pulse_excluded_owners || [],
    };

    return NextResponse.json({
      owners,
      settings: pulseSettings,
    });
  } catch (error) {
    console.error("Error fetching pulse settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PUT /api/settings/pulse - Update pulse owner exclusion settings
export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's organization and access level
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Require admin access
  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const organizationId = profile.organization_id;

  try {
    const body = await req.json();
    const { growth_pulse_excluded_owners, customer_pulse_excluded_owners } = body as PulseSettings;

    // Validate input
    if (!Array.isArray(growth_pulse_excluded_owners) || !Array.isArray(customer_pulse_excluded_owners)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Get current org settings
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single();

    const currentSettings = (org?.settings as Record<string, unknown>) || {};

    // Update pulse_settings within the settings JSONB
    const newSettings = {
      ...currentSettings,
      pulse_settings: {
        growth_pulse_excluded_owners,
        customer_pulse_excluded_owners,
      },
    };

    const { error } = await supabase
      .from("organizations")
      .update({ settings: newSettings })
      .eq("id", organizationId);

    if (error) {
      console.error("Error updating pulse settings:", error);
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating pulse settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
