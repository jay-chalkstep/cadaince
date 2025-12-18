import { createAdminClient } from "@/lib/supabase/server";
import { getTimeRange, formatDateISO, type TimeWindow } from "./time-windows";
import { hubspotClient } from "../hubspot/client";
import { bigqueryClient } from "../bigquery/client";

interface FormulaReference {
  variable: string; // 'A', 'B', 'C', etc.
  type: "metric" | "data_source";
  id: string; // metric_id or data_source_id
  time_window?: string; // Required if type is 'data_source'
}

interface DataSource {
  id: string;
  source_type: "hubspot" | "bigquery";
  hubspot_object: string | null;
  hubspot_property: string | null;
  hubspot_aggregation: string | null;
  hubspot_filters: unknown[] | null;
  bigquery_query: string | null;
  bigquery_value_column: string | null;
}

/**
 * Safely evaluate a mathematical formula
 * Only supports: numbers, +, -, *, /, (, ), and variable names (A-Z)
 */
function safeEvaluate(formula: string, variables: Record<string, number>): number {
  // Replace variable names with their values
  let expression = formula.toUpperCase();

  for (const [varName, value] of Object.entries(variables)) {
    expression = expression.replace(new RegExp(varName, "g"), String(value));
  }

  // Validate the expression only contains safe characters
  if (!/^[\d\s+\-*/().]+$/.test(expression)) {
    throw new Error(`Invalid formula: contains unsafe characters`);
  }

  // Use Function constructor for safe evaluation (no access to global scope)
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${expression})`)();

    if (typeof result !== "number" || !isFinite(result)) {
      throw new Error("Formula result is not a valid number");
    }

    return result;
  } catch (error) {
    throw new Error(`Formula evaluation error: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

/**
 * Fetch value from a data source for a specific time window
 */
async function fetchDataSourceValue(
  dataSource: DataSource,
  timeWindow: TimeWindow
): Promise<number | null> {
  const { start, end } = getTimeRange(timeWindow);

  if (dataSource.source_type === "hubspot") {
    if (!hubspotClient.isConfigured()) {
      return null;
    }

    const result = await hubspotClient.fetchMetric({
      object: dataSource.hubspot_object as "deals" | "contacts" | "tickets" | "feedback_submissions",
      property: dataSource.hubspot_property!,
      aggregation: dataSource.hubspot_aggregation as "sum" | "avg" | "count" | "min" | "max",
      filters: dataSource.hubspot_filters as Record<string, unknown> | undefined,
      date_range: "custom",
      custom_date_field: "createdate",
    });

    return result.success ? (result.value ?? null) : null;
  } else if (dataSource.source_type === "bigquery") {
    if (!bigqueryClient.isConfigured()) {
      return null;
    }

    const query = dataSource.bigquery_query!
      .replace(/\{\{start\}\}/g, formatDateISO(start))
      .replace(/\{\{end\}\}/g, formatDateISO(end));

    const result = await bigqueryClient.fetchMetric({
      query,
      value_column: dataSource.bigquery_value_column!,
    });

    return result.success ? (result.value ?? null) : null;
  }

  return null;
}

/**
 * Fetch the current value of a metric
 */
async function fetchMetricValue(metricId: string): Promise<number | null> {
  const supabase = createAdminClient();

  const { data: latestValue } = await supabase
    .from("metric_values")
    .select("value")
    .eq("metric_id", metricId)
    .is("time_window", null)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();

  return latestValue?.value ?? null;
}

/**
 * Calculate the value of a calculated metric based on its formula and references
 */
export async function calculateMetricValue(
  formula: string,
  references: FormulaReference[]
): Promise<{ success: boolean; value?: number; error?: string }> {
  const supabase = createAdminClient();
  const variables: Record<string, number> = {};

  try {
    // Resolve all variable references
    for (const ref of references) {
      let value: number | null = null;

      if (ref.type === "metric") {
        value = await fetchMetricValue(ref.id);
      } else if (ref.type === "data_source") {
        if (!ref.time_window) {
          return {
            success: false,
            error: `Data source reference ${ref.variable} missing time_window`,
          };
        }

        // Get the data source
        const { data: dataSource, error } = await supabase
          .from("data_sources")
          .select("*")
          .eq("id", ref.id)
          .single();

        if (error || !dataSource) {
          return {
            success: false,
            error: `Data source ${ref.id} not found`,
          };
        }

        value = await fetchDataSourceValue(dataSource, ref.time_window as TimeWindow);
      }

      if (value === null) {
        return {
          success: false,
          error: `Could not resolve value for variable ${ref.variable}`,
        };
      }

      variables[ref.variable] = value;
    }

    // Evaluate the formula
    const result = safeEvaluate(formula, variables);

    return {
      success: true,
      value: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync a calculated metric
 */
export async function syncCalculatedMetric(metric: {
  id: string;
  name: string;
  formula: string;
  formula_references: FormulaReference[];
}): Promise<{ success: boolean; value?: number; error?: string }> {
  const supabase = createAdminClient();

  // Log sync start
  const { data: logEntry } = await supabase
    .from("sync_logs")
    .insert({
      metric_id: metric.id,
      status: "running",
    })
    .select()
    .single();

  const logId = logEntry?.id;

  try {
    const result = await calculateMetricValue(metric.formula, metric.formula_references);

    if (result.success && result.value !== undefined) {
      // Record the calculated value
      await supabase.from("metric_values").insert({
        metric_id: metric.id,
        value: result.value,
        source: "calculated",
        notes: `Calculated: ${metric.formula}`,
      });

      // Update metric last_sync_at
      await supabase
        .from("metrics")
        .update({
          last_sync_at: new Date().toISOString(),
          sync_error: null,
        })
        .eq("id", metric.id);

      // Update sync log
      if (logId) {
        await supabase
          .from("sync_logs")
          .update({
            completed_at: new Date().toISOString(),
            status: "success",
            records_processed: 1,
          })
          .eq("id", logId);
      }

      return result;
    }

    // Handle error
    const errorMessage = result.error || "Calculation failed";

    await supabase
      .from("metrics")
      .update({
        sync_error: errorMessage,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", metric.id);

    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          status: "error",
          error_message: errorMessage,
        })
        .eq("id", logId);
    }

    return { success: false, error: errorMessage };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await supabase
      .from("metrics")
      .update({
        sync_error: errorMessage,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", metric.id);

    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          status: "error",
          error_message: errorMessage,
        })
        .eq("id", logId);
    }

    return { success: false, error: errorMessage };
  }
}
