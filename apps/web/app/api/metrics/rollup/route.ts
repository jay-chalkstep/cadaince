import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/metrics/rollup - Trigger rollup recalculation for specified metrics
 *
 * This is useful when:
 * - Bulk importing child metric values
 * - Fixing out-of-sync rollup values
 * - Changing aggregation types
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin and ELT can trigger rollup
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { metric_ids, all_rollups } = body as {
    metric_ids?: string[];
    all_rollups?: boolean;
  };

  let metricsToRecalculate: Array<{ id: string; aggregation_type: string }>;

  if (all_rollups) {
    // Get all rollup metrics for the org
    const { data, error } = await supabase
      .from("metrics")
      .select("id, aggregation_type")
      .eq("organization_id", profile.organization_id)
      .eq("is_rollup", true)
      .not("aggregation_type", "is", null);

    if (error) {
      console.error("Error fetching rollup metrics:", error);
      return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
    }

    metricsToRecalculate = data || [];
  } else if (metric_ids && metric_ids.length > 0) {
    // Get specified metrics
    const { data, error } = await supabase
      .from("metrics")
      .select("id, aggregation_type")
      .eq("organization_id", profile.organization_id)
      .in("id", metric_ids)
      .not("aggregation_type", "is", null);

    if (error) {
      console.error("Error fetching specified metrics:", error);
      return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
    }

    metricsToRecalculate = data || [];
  } else {
    return NextResponse.json(
      { error: "Either metric_ids or all_rollups=true is required" },
      { status: 400 }
    );
  }

  // Recalculate each metric
  const results: Array<{
    metric_id: string;
    old_value: number | null;
    new_value: number | null;
    success: boolean;
    error?: string;
  }> = [];

  for (const metric of metricsToRecalculate) {
    try {
      // Get current value
      const { data: currentValue } = await supabase
        .from("metric_values")
        .select("value")
        .eq("metric_id", metric.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      // Calculate new rollup value using the database function
      const { data: rollupResult, error: rollupError } = await supabase
        .rpc("calculate_metric_rollup", { p_metric_id: metric.id });

      if (rollupError) {
        results.push({
          metric_id: metric.id,
          old_value: currentValue?.value ?? null,
          new_value: null,
          success: false,
          error: rollupError.message,
        });
        continue;
      }

      const newValue = rollupResult as number | null;

      // Only insert if value is different
      if (newValue !== null && newValue !== currentValue?.value) {
        await supabase.from("metric_values").insert({
          metric_id: metric.id,
          value: newValue,
          source: "rollup",
          notes: "Manual rollup recalculation",
        });
      }

      results.push({
        metric_id: metric.id,
        old_value: currentValue?.value ?? null,
        new_value: newValue,
        success: true,
      });
    } catch (err) {
      results.push({
        metric_id: metric.id,
        old_value: null,
        new_value: null,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    total: results.length,
    successful,
    failed,
    results,
  });
}

/**
 * GET /api/metrics/rollup - Get all rollup metrics with their hierarchy
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Get all rollup metrics
  const { data: rollupMetrics, error } = await supabase
    .from("metrics")
    .select(`
      id,
      name,
      description,
      goal,
      unit,
      frequency,
      aggregation_type,
      is_rollup,
      team_id,
      team:teams!metrics_team_id_fkey(id, name, level)
    `)
    .eq("organization_id", profile.organization_id)
    .eq("is_rollup", true)
    .order("name");

  if (error) {
    console.error("Error fetching rollup metrics:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }

  // For each rollup metric, get child count and latest value
  const metricsWithData = await Promise.all(
    (rollupMetrics || []).map(async (metric) => {
      const [childCountResult, latestValueResult] = await Promise.all([
        supabase
          .from("metrics")
          .select("id", { count: "exact", head: true })
          .eq("parent_metric_id", metric.id),
        supabase
          .from("metric_values")
          .select("value, recorded_at")
          .eq("metric_id", metric.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .single(),
      ]);

      return {
        ...metric,
        child_count: childCountResult.count || 0,
        latest_value: latestValueResult.data?.value ?? null,
        latest_recorded_at: latestValueResult.data?.recorded_at ?? null,
      };
    })
  );

  return NextResponse.json({
    metrics: metricsWithData,
    total: metricsWithData.length,
  });
}
