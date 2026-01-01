import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/metrics/:id/children - List child metrics that roll up to this metric
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Verify parent metric exists and belongs to org
  const { data: parentMetric } = await supabase
    .from("metrics")
    .select("id, name, aggregation_type, is_rollup")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!parentMetric) {
    return NextResponse.json({ error: "Metric not found" }, { status: 404 });
  }

  // Get child metrics
  const { data: children, error } = await supabase
    .from("metrics")
    .select(`
      id,
      name,
      description,
      goal,
      unit,
      frequency,
      team_id,
      owner_id,
      team:teams!metrics_team_id_fkey(id, name, level),
      owner:profiles!metrics_owner_id_fkey(id, full_name, avatar_url)
    `)
    .eq("parent_metric_id", id)
    .eq("organization_id", profile.organization_id)
    .order("name");

  if (error) {
    console.error("Error fetching child metrics:", error);
    return NextResponse.json({ error: "Failed to fetch child metrics" }, { status: 500 });
  }

  // Get latest values for each child metric
  const childrenWithValues = await Promise.all(
    (children || []).map(async (child) => {
      const { data: latestValue } = await supabase
        .from("metric_values")
        .select("value, recorded_at")
        .eq("metric_id", child.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      return {
        ...child,
        latest_value: latestValue?.value ?? null,
        latest_recorded_at: latestValue?.recorded_at ?? null,
      };
    })
  );

  return NextResponse.json({
    parent: parentMetric,
    children: childrenWithValues,
    total: childrenWithValues.length,
  });
}

/**
 * POST /api/metrics/:id/children - Create a child metric that rolls up to parent
 */
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin and ELT can create metrics
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify parent metric exists
  const { data: parentMetric } = await supabase
    .from("metrics")
    .select("id, name, unit, frequency, aggregation_type")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!parentMetric) {
    return NextResponse.json({ error: "Parent metric not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    name,
    description,
    goal,
    unit,
    frequency,
    team_id,
    owner_id,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Create child metric
  const { data: childMetric, error } = await supabase
    .from("metrics")
    .insert({
      organization_id: profile.organization_id,
      name,
      description: description || null,
      goal: goal || null,
      unit: unit || parentMetric.unit,
      frequency: frequency || parentMetric.frequency,
      team_id: team_id || null,
      owner_id: owner_id || null,
      parent_metric_id: id,
      source_type: "manual",
    })
    .select(`
      id,
      name,
      description,
      goal,
      unit,
      frequency,
      team_id,
      owner_id,
      parent_metric_id
    `)
    .single();

  if (error) {
    console.error("Error creating child metric:", error);
    return NextResponse.json({ error: "Failed to create child metric" }, { status: 500 });
  }

  // If parent doesn't have aggregation type set, default to sum
  if (!parentMetric.aggregation_type) {
    await supabase
      .from("metrics")
      .update({ aggregation_type: "sum", is_rollup: true })
      .eq("id", id);
  }

  return NextResponse.json(childMetric, { status: 201 });
}
