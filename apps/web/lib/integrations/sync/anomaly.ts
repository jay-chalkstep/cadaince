import { createAdminClient } from "@/lib/supabase/server";
import type { AnomalyResult, ThresholdConfig } from "../types";

interface MetricWithValues {
  id: string;
  name: string;
  goal: number | null;
  metric_values: Array<{ value: number; recorded_at: string }>;
  metric_thresholds: ThresholdConfig[];
}

/**
 * Detect anomalies across all active metrics
 */
export async function detectAnomalies(): Promise<AnomalyResult[]> {
  const supabase = createAdminClient();
  const anomalies: AnomalyResult[] = [];
  const now = new Date().toISOString();

  // Get all active metrics with recent values and thresholds
  const { data: metrics, error } = await supabase
    .from("metrics")
    .select(`
      id,
      name,
      goal,
      metric_values(value, recorded_at),
      metric_thresholds(*)
    `)
    .eq("is_active", true)
    .order("recorded_at", { foreignTable: "metric_values", ascending: false })
    .limit(30, { foreignTable: "metric_values" });

  if (error || !metrics) {
    console.error("Error fetching metrics for anomaly detection:", error);
    return [];
  }

  for (const metric of metrics as MetricWithValues[]) {
    const values = metric.metric_values || [];

    if (values.length < 1) {
      // Check for missing data
      const lastValue = values[0];
      if (lastValue) {
        const lastRecordedAt = new Date(lastValue.recorded_at);
        const hoursSinceLastValue = (Date.now() - lastRecordedAt.getTime()) / (1000 * 60 * 60);

        // Alert if no data for 24+ hours for external metrics
        if (hoursSinceLastValue > 24) {
          anomalies.push({
            metric_id: metric.id,
            metric_name: metric.name,
            anomaly_type: "missing",
            severity: "warning",
            current_value: null,
            expected_value: null,
            deviation_percent: null,
            message: `No data received for ${Math.round(hoursSinceLastValue)} hours`,
            detected_at: now,
          });
        }
      }
      continue;
    }

    const currentValue = values[0].value;
    const previousValues = values.slice(1, 8); // Last 7 values for comparison

    // Check thresholds
    for (const threshold of metric.metric_thresholds || []) {
      if (!threshold.is_active) continue;

      let breached = false;

      switch (threshold.threshold_type) {
        case "below":
          breached = currentValue < threshold.threshold_value;
          break;
        case "above":
          breached = currentValue > threshold.threshold_value;
          break;
        case "change_percent":
          if (previousValues.length > 0) {
            const prevValue = previousValues[0].value;
            const changePercent = prevValue !== 0
              ? Math.abs((currentValue - prevValue) / prevValue) * 100
              : 0;
            breached = changePercent > threshold.threshold_value;
          }
          break;
      }

      if (breached) {
        // Check consecutive periods if required
        if (threshold.consecutive_periods > 1 && previousValues.length >= threshold.consecutive_periods - 1) {
          let consecutiveBreaches = 1;
          for (let i = 0; i < threshold.consecutive_periods - 1 && i < previousValues.length; i++) {
            const val = previousValues[i].value;
            const prevBreached =
              threshold.threshold_type === "below"
                ? val < threshold.threshold_value
                : val > threshold.threshold_value;
            if (prevBreached) {
              consecutiveBreaches++;
            } else {
              break;
            }
          }

          if (consecutiveBreaches < threshold.consecutive_periods) {
            continue; // Not enough consecutive breaches
          }
        }

        anomalies.push({
          metric_id: metric.id,
          metric_name: metric.name,
          anomaly_type: "threshold",
          severity: threshold.severity,
          current_value: currentValue,
          expected_value: threshold.threshold_value,
          deviation_percent: null,
          message: `${metric.name} is ${threshold.threshold_type} threshold (${currentValue.toFixed(2)} vs ${threshold.threshold_value})`,
          detected_at: now,
        });
      }
    }

    // Check for statistical deviation (>2 std dev from mean)
    if (previousValues.length >= 5) {
      const mean =
        previousValues.reduce((a, b) => a + b.value, 0) / previousValues.length;
      const variance =
        previousValues.reduce((a, b) => a + Math.pow(b.value - mean, 2), 0) /
        previousValues.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 0) {
        const zScore = Math.abs((currentValue - mean) / stdDev);

        if (zScore > 2) {
          const deviationPercent = ((currentValue - mean) / mean) * 100;
          const severity = zScore > 3 ? "critical" : "warning";

          anomalies.push({
            metric_id: metric.id,
            metric_name: metric.name,
            anomaly_type: "deviation",
            severity,
            current_value: currentValue,
            expected_value: mean,
            deviation_percent: deviationPercent,
            message: `${metric.name} deviated ${Math.abs(deviationPercent).toFixed(1)}% from recent average (${currentValue.toFixed(2)} vs ${mean.toFixed(2)} avg)`,
            detected_at: now,
          });
        }
      }
    }

    // Check for significant trend changes
    if (previousValues.length >= 3) {
      const recentTrend = calculateTrend(values.slice(0, 4).map((v) => v.value));
      const historicalTrend = calculateTrend(values.slice(3, 7).map((v) => v.value));

      // Alert if trend reversed significantly
      if (
        (recentTrend > 0.1 && historicalTrend < -0.1) ||
        (recentTrend < -0.1 && historicalTrend > 0.1)
      ) {
        anomalies.push({
          metric_id: metric.id,
          metric_name: metric.name,
          anomaly_type: "trend",
          severity: "info",
          current_value: currentValue,
          expected_value: null,
          deviation_percent: null,
          message: `${metric.name} trend has reversed: was ${historicalTrend > 0 ? "increasing" : "decreasing"}, now ${recentTrend > 0 ? "increasing" : "decreasing"}`,
          detected_at: now,
        });
      }
    }
  }

  // Store anomalies and create alerts for critical ones
  await storeAnomalies(anomalies);

  return anomalies;
}

/**
 * Calculate the trend slope from a series of values
 */
function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;

  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Normalize by mean to get relative trend
  const mean = sumY / n;
  return mean !== 0 ? slope / mean : slope;
}

/**
 * Store anomalies in the database and create alerts for critical ones
 */
async function storeAnomalies(anomalies: AnomalyResult[]): Promise<void> {
  const supabase = createAdminClient();

  for (const anomaly of anomalies) {
    // Store the anomaly
    const { data: storedAnomaly } = await supabase
      .from("metric_anomalies")
      .insert({
        metric_id: anomaly.metric_id,
        anomaly_type: anomaly.anomaly_type,
        severity: anomaly.severity,
        current_value: anomaly.current_value,
        expected_value: anomaly.expected_value,
        deviation_percent: anomaly.deviation_percent,
        message: anomaly.message,
        detected_at: anomaly.detected_at,
      })
      .select()
      .single();

    // Create an alert for warning and critical anomalies
    if (anomaly.severity !== "info" && storedAnomaly) {
      const { data: alert } = await supabase
        .from("alerts")
        .insert({
          type: "anomaly",
          severity: anomaly.severity === "critical" ? "urgent" : "normal",
          title: `${anomaly.anomaly_type.charAt(0).toUpperCase() + anomaly.anomaly_type.slice(1)} Alert: ${anomaly.metric_name}`,
          description: anomaly.message,
          metric_id: anomaly.metric_id,
          config: {
            anomaly_id: storedAnomaly.id,
            anomaly_type: anomaly.anomaly_type,
            current_value: anomaly.current_value,
            expected_value: anomaly.expected_value,
          },
        })
        .select()
        .single();

      // Link alert to anomaly
      if (alert) {
        await supabase
          .from("metric_anomalies")
          .update({ alert_id: alert.id })
          .eq("id", storedAnomaly.id);
      }
    }
  }
}

/**
 * Get recent anomalies for a specific metric
 */
export async function getMetricAnomalies(
  metricId: string,
  limit: number = 10
): Promise<AnomalyResult[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("metric_anomalies")
    .select(`
      *,
      metric:metrics(name)
    `)
    .eq("metric_id", metricId)
    .order("detected_at", { ascending: false })
    .limit(limit);

  if (!data) return [];

  return data.map((row) => ({
    metric_id: row.metric_id,
    metric_name: row.metric?.name || "Unknown",
    anomaly_type: row.anomaly_type,
    severity: row.severity,
    current_value: row.current_value,
    expected_value: row.expected_value,
    deviation_percent: row.deviation_percent,
    message: row.message,
    detected_at: row.detected_at,
  }));
}

/**
 * Get all unresolved anomalies
 */
export async function getUnresolvedAnomalies(): Promise<AnomalyResult[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("metric_anomalies")
    .select(`
      *,
      metric:metrics(name)
    `)
    .is("resolved_at", null)
    .order("detected_at", { ascending: false })
    .limit(50);

  if (!data) return [];

  return data.map((row) => ({
    metric_id: row.metric_id,
    metric_name: row.metric?.name || "Unknown",
    anomaly_type: row.anomaly_type,
    severity: row.severity,
    current_value: row.current_value,
    expected_value: row.expected_value,
    deviation_percent: row.deviation_percent,
    message: row.message,
    detected_at: row.detected_at,
  }));
}
