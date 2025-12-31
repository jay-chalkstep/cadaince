import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/integrations - List all integrations (admin only)
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Check if user is admin and get organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  if (!profile.organization_id) {
    return NextResponse.json([]);
  }

  const { data: integrations, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("type", { ascending: true });

  if (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }

  // Mask sensitive data in config
  const safeIntegrations = integrations.map((integration) => ({
    ...integration,
    config: {
      ...integration.config,
      // Don't expose any secrets that might be in config
    },
  }));

  return NextResponse.json(safeIntegrations);
}

// POST /api/integrations - Create or update an integration
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Check if user is admin and get organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  if (!profile.organization_id) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const body = await req.json();
  const { type, name, is_active, config } = body;

  if (!type || !name) {
    return NextResponse.json(
      { error: "Type and name are required" },
      { status: 400 }
    );
  }

  // Validate type
  const validTypes = ["hubspot", "bigquery", "slack", "google_calendar"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // Upsert integration (one per type per organization)
  const { data: integration, error } = await supabase
    .from("integrations")
    .upsert(
      {
        organization_id: profile.organization_id,
        type,
        name,
        is_active: is_active ?? false,
        config: config || {},
      },
      {
        onConflict: "organization_id,type",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error creating integration:", error);
    return NextResponse.json({ error: "Failed to create integration" }, { status: 500 });
  }

  return NextResponse.json(integration, { status: 201 });
}
