import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/metrics - List all metrics with current values for user's organization
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("team_id");
  const ownerId = searchParams.get("owner_id");

  const supabase = createAdminClient();

  // Get user's organization
  const { data: currentUser } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!currentUser?.organization_id) {
    return NextResponse.json([]);
  }

  // Get all metrics with owner info for user's organization
  let query = supabase
    .from("metrics")
    .select(`
      *,
      owner:profiles!metrics_owner_id_fkey(id, full_name, avatar_url),
      team:teams!metrics_team_id_fkey(id, name, level)
    `)
    .eq("organization_id", currentUser.organization_id)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }

  const { data: metrics, error } = await query;

  if (error) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }

  // Get values for each metric
  const metricsWithValues = await Promise.all(
    metrics.map(async (metric) => {
      const metricType = metric.metric_type || "manual";

      // For multi-window metrics, get the latest value for each window
      if (metricType === "multi_window" && metric.time_windows?.length > 0) {
        const valuesByWindow: Record<string, number | null> = {};
        const statusByWindow: Record<string, "on_track" | "at_risk" | "off_track"> = {};

        for (const window of metric.time_windows) {
          const { data: latestValue } = await supabase
            .from("metric_values")
            .select("value, recorded_at")
            .eq("metric_id", metric.id)
            .eq("time_window", window)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .single();

          valuesByWindow[window] = latestValue?.value ?? null;

          // Calculate status for this window
          const goal = metric.goals_by_window?.[window];
          const thresholds = metric.thresholds_by_window?.[window];
          let windowStatus: "on_track" | "at_risk" | "off_track" = "on_track";

          if (latestValue && goal) {
            const value = latestValue.value;
            if (thresholds?.red && value <= thresholds.red) {
              windowStatus = "off_track";
            } else if (thresholds?.yellow && value <= thresholds.yellow) {
              windowStatus = "at_risk";
            }
          }
          statusByWindow[window] = windowStatus;
        }

        return {
          ...metric,
          values_by_window: valuesByWindow,
          status_by_window: statusByWindow,
          current_value: null,
          recorded_at: null,
          trend: "flat" as const,
          status: "on_track" as const,
        };
      }

      // For single_window metrics
      if (metricType === "single_window" && metric.time_window) {
        const { data: latestValue } = await supabase
          .from("metric_values")
          .select("value, recorded_at")
          .eq("metric_id", metric.id)
          .eq("time_window", metric.time_window)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .single();

        let status: "on_track" | "at_risk" | "off_track" = "on_track";
        if (latestValue && metric.goal) {
          if (metric.threshold_red !== null && latestValue.value <= metric.threshold_red) {
            status = "off_track";
          } else if (metric.threshold_yellow !== null && latestValue.value <= metric.threshold_yellow) {
            status = "at_risk";
          }
        }

        return {
          ...metric,
          current_value: latestValue?.value ?? null,
          recorded_at: latestValue?.recorded_at ?? null,
          trend: "flat" as const,
          status,
        };
      }

      // For manual metrics (legacy behavior)
      const { data: latestValue } = await supabase
        .from("metric_values")
        .select("*")
        .eq("metric_id", metric.id)
        .is("time_window", null)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      // Get previous value for trend calculation
      const { data: previousValues } = await supabase
        .from("metric_values")
        .select("value")
        .eq("metric_id", metric.id)
        .is("time_window", null)
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

  // Check if user is admin and get organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!profile.organization_id) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
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
    // New fields for data source-based metrics
    metric_type,
    data_source_id,
    time_window,
    time_windows,
    goals_by_window,
    thresholds_by_window,
    sync_frequency,
    // For calculated metrics
    formula,
    formula_references,
    // For team scoping
    team_id,
  } = body;

  if (!name || !owner_id) {
    return NextResponse.json(
      { error: "Name and owner_id are required" },
      { status: 400 }
    );
  }

  // Validate metric_type
  const validMetricTypes = ["manual", "single_window", "multi_window", "calculated"];
  const effectiveMetricType = metric_type || "manual";
  if (!validMetricTypes.includes(effectiveMetricType)) {
    return NextResponse.json(
      { error: `metric_type must be one of: ${validMetricTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate data source for window-based metrics
  if ((effectiveMetricType === "single_window" || effectiveMetricType === "multi_window") && !data_source_id) {
    return NextResponse.json(
      { error: "data_source_id is required for single_window and multi_window metrics" },
      { status: 400 }
    );
  }

  // Validate time_window for single_window metrics
  if (effectiveMetricType === "single_window" && !time_window) {
    return NextResponse.json(
      { error: "time_window is required for single_window metrics" },
      { status: 400 }
    );
  }

  // Validate time_windows for multi_window metrics
  if (effectiveMetricType === "multi_window" && (!time_windows || time_windows.length === 0)) {
    return NextResponse.json(
      { error: "time_windows is required for multi_window metrics" },
      { status: 400 }
    );
  }

  // Validate calculated metrics
  if (effectiveMetricType === "calculated" && !formula) {
    return NextResponse.json(
      { error: "formula is required for calculated metrics" },
      { status: 400 }
    );
  }

  // Build insert object
  const insertData: Record<string, unknown> = {
    name,
    description,
    owner_id,
    unit,
    frequency: frequency || "weekly",
    display_order,
    metric_type: effectiveMetricType,
    organization_id: profile.organization_id,
    team_id: team_id || null,
  };

  // Add fields based on metric type
  if (effectiveMetricType === "manual") {
    insertData.goal = goal;
    insertData.threshold_red = threshold_red;
    insertData.threshold_yellow = threshold_yellow;
  } else if (effectiveMetricType === "single_window") {
    insertData.data_source_id = data_source_id;
    insertData.time_window = time_window;
    insertData.goal = goal;
    insertData.threshold_red = threshold_red;
    insertData.threshold_yellow = threshold_yellow;
    insertData.sync_frequency = sync_frequency || "15min";
  } else if (effectiveMetricType === "multi_window") {
    insertData.data_source_id = data_source_id;
    insertData.time_windows = time_windows;
    insertData.goals_by_window = goals_by_window || {};
    insertData.thresholds_by_window = thresholds_by_window || {};
    insertData.sync_frequency = sync_frequency || "15min";
  } else if (effectiveMetricType === "calculated") {
    insertData.formula = formula;
    insertData.formula_references = formula_references || [];
    insertData.goal = goal;
    insertData.threshold_red = threshold_red;
    insertData.threshold_yellow = threshold_yellow;
  }

  const { data: metric, error } = await supabase
    .from("metrics")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error creating metric:", error);
    return NextResponse.json({ error: "Failed to create metric" }, { status: 500 });
  }

  return NextResponse.json(metric, { status: 201 });
}
