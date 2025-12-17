import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/metrics - List all metrics with current values
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get all metrics with owner info and latest value
  const { data: metrics, error } = await supabase
    .from("metrics")
    .select(`
      *,
      owner:profiles!metrics_owner_id_fkey(id, full_name, avatar_url)
    `)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }

  // Get latest value for each metric
  const metricsWithValues = await Promise.all(
    metrics.map(async (metric) => {
      const { data: latestValue } = await supabase
        .from("metric_values")
        .select("*")
        .eq("metric_id", metric.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      // Get previous value for trend calculation
      const { data: previousValues } = await supabase
        .from("metric_values")
        .select("value")
        .eq("metric_id", metric.id)
        .order("recorded_at", { ascending: false })
        .limit(2);

      let trend: "up" | "down" | "flat" = "flat";
      if (previousValues && previousValues.length >= 2) {
        const current = previousValues[0].value;
        const previous = previousValues[1].value;
        if (current > previous) trend = "up";
        else if (current < previous) trend = "down";
      }

      // Calculate status based on thresholds
      let status: "on_track" | "at_risk" | "off_track" = "on_track";
      if (latestValue && metric.goal) {
        const value = latestValue.value;
        const goal = metric.goal;

        if (metric.threshold_red !== null && value <= metric.threshold_red) {
          status = "off_track";
        } else if (metric.threshold_yellow !== null && value <= metric.threshold_yellow) {
          status = "at_risk";
        }
      }

      return {
        ...metric,
        current_value: latestValue?.value ?? null,
        recorded_at: latestValue?.recorded_at ?? null,
        trend,
        status,
      };
    })
  );

  return NextResponse.json(metricsWithValues);
}

// POST /api/metrics - Create a new metric (admin only)
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name,
    description,
    owner_id,
    goal,
    unit,
    frequency,
    threshold_red,
    threshold_yellow,
    display_order,
  } = body;

  if (!name || !owner_id) {
    return NextResponse.json(
      { error: "Name and owner_id are required" },
      { status: 400 }
    );
  }

  const { data: metric, error } = await supabase
    .from("metrics")
    .insert({
      name,
      description,
      owner_id,
      goal,
      unit,
      frequency: frequency || "weekly",
      threshold_red,
      threshold_yellow,
      display_order,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating metric:", error);
    return NextResponse.json({ error: "Failed to create metric" }, { status: 500 });
  }

  return NextResponse.json(metric, { status: 201 });
}
