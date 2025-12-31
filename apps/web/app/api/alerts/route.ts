import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/alerts - List alerts
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const severity = searchParams.get("severity");
  const acknowledged = searchParams.get("acknowledged");
  const limit = parseInt(searchParams.get("limit") || "50");

  const supabase = createAdminClient();

  // Get current user's profile and organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (!profile.organization_id) {
    return NextResponse.json([]);
  }

  let query = supabase
    .from("alerts")
    .select(`
      *,
      triggered_by_profile:profiles!alerts_triggered_by_fkey(id, full_name, avatar_url),
      update:updates(id, content, format),
      metric:metrics(id, name, goal, unit),
      acknowledgments:alert_acknowledgments(
        id,
        profile_id,
        acknowledged_at,
        profile:profiles(id, full_name, avatar_url)
      )
    `)
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq("type", type);
  }
  if (severity) {
    query = query.eq("severity", severity);
  }

  const { data: alerts, error } = await query;

  if (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }

  // Filter by acknowledgment status if requested
  let filteredAlerts = alerts || [];
  if (acknowledged === "true") {
    filteredAlerts = filteredAlerts.filter((alert) =>
      alert.acknowledgments?.some((ack: { profile_id: string }) => ack.profile_id === profile.id)
    );
  } else if (acknowledged === "false") {
    filteredAlerts = filteredAlerts.filter(
      (alert) =>
        !alert.acknowledgments?.some((ack: { profile_id: string }) => ack.profile_id === profile.id)
    );
  }

  return NextResponse.json(filteredAlerts);
}

// POST /api/alerts - Create a new alert
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get current user's profile and organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (!profile.organization_id) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const body = await req.json();
  const { type, severity, title, description, update_id, metric_id, config } = body;

  if (!type || !title) {
    return NextResponse.json(
      { error: "Type and title are required" },
      { status: 400 }
    );
  }

  const { data: alert, error } = await supabase
    .from("alerts")
    .insert({
      organization_id: profile.organization_id,
      type,
      severity: severity || "normal",
      title,
      description: description || null,
      triggered_by: type === "human" ? profile.id : null,
      update_id: update_id || null,
      metric_id: metric_id || null,
      config: config || null,
    })
    .select(`
      *,
      triggered_by_profile:profiles!alerts_triggered_by_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error creating alert:", error);
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }

  return NextResponse.json(alert, { status: 201 });
}
