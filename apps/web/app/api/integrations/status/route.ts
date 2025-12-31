import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface IntegrationStatus {
  integration_type: string;
  status: string;
  connected_at: string | null;
  config: Record<string, unknown>;
}

// GET /api/integrations/status - Get user's integration statuses
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get all user integrations
  const { data: integrations, error } = await supabase
    .from("user_integrations")
    .select("integration_type, status, connected_at, config")
    .eq("profile_id", profile.id);

  if (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }

  // Build status map
  const statusMap: Record<string, IntegrationStatus> = {};
  for (const integration of integrations || []) {
    statusMap[integration.integration_type] = {
      integration_type: integration.integration_type,
      status: integration.status,
      connected_at: integration.connected_at,
      config: integration.config || {},
    };
  }

  // Get available integration types
  const { data: integrationTypes } = await supabase
    .from("integration_types")
    .select("id, name, description, scope_level, is_active")
    .eq("is_active", true);

  return NextResponse.json({
    integrations: statusMap,
    available_types: integrationTypes || [],
  });
}
