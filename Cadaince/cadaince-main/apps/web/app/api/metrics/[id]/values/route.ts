import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/metrics/:id/values - Get historical values
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "52"); // Default 52 weeks

  const supabase = createAdminClient();

  const { data: values, error } = await supabase
    .from("metric_values")
    .select("*")
    .eq("metric_id", id)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching metric values:", error);
    return NextResponse.json({ error: "Failed to fetch values" }, { status: 500 });
  }

  return NextResponse.json(values);
}

// POST /api/metrics/:id/values - Record a new value
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

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get the metric to check ownership
  const { data: metric } = await supabase
    .from("metrics")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!metric) {
    return NextResponse.json({ error: "Metric not found" }, { status: 404 });
  }

  // Check if user is admin or owner
  if (profile.access_level !== "admin" && metric.owner_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { value, notes, recorded_at } = body;

  if (value === undefined || value === null) {
    return NextResponse.json({ error: "Value is required" }, { status: 400 });
  }

  const { data: metricValue, error } = await supabase
    .from("metric_values")
    .insert({
      metric_id: id,
      value,
      notes,
      recorded_at: recorded_at || new Date().toISOString(),
      source: "manual",
    })
    .select()
    .single();

  if (error) {
    console.error("Error recording metric value:", error);
    return NextResponse.json({ error: "Failed to record value" }, { status: 500 });
  }

  return NextResponse.json(metricValue, { status: 201 });
}
