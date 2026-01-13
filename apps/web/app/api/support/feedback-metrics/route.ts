import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { FeedbackMetrics, ScoreMetric } from "@/types/support-pulse";

// The three "How" question fields from HubSpot feedback surveys
const SCORE_FIELDS = {
  resolution: "how_satisfied_are_you_with_the_resolution_of_your_issue_",
  responseTime: "how_satidfied_are_you_with_the_response_time_of_our_agents_", // Note: typo in HubSpot field
  helpfulness: "how_would_you_rate_the_helpfulness_of_our_customer_service_representatives_",
} as const;

const TREND_THRESHOLD = 0.2;

interface FeedbackRecord {
  properties: Record<string, unknown>;
}

function calculateAverageForField(
  records: FeedbackRecord[],
  fieldName: string
): { score: number | null; count: number } {
  let total = 0;
  let count = 0;

  for (const record of records) {
    const scoreValue = record.properties[fieldName];
    if (scoreValue !== null && scoreValue !== undefined && scoreValue !== "") {
      const score = parseFloat(String(scoreValue));
      if (!isNaN(score) && score >= 0 && score <= 10) {
        total += score;
        count++;
      }
    }
  }

  return {
    score: count > 0 ? Math.round((total / count) * 10) / 10 : null,
    count,
  };
}

function determineTrend(current: number | null, previous: number | null): "up" | "down" | "neutral" {
  if (current === null || previous === null) return "neutral";
  const diff = current - previous;
  if (diff > TREND_THRESHOLD) return "up";
  if (diff < -TREND_THRESHOLD) return "down";
  return "neutral";
}

function buildScoreMetric(
  currentRecords: FeedbackRecord[],
  previousRecords: FeedbackRecord[],
  fieldName: string
): ScoreMetric {
  const current = calculateAverageForField(currentRecords, fieldName);
  const previous = calculateAverageForField(previousRecords, fieldName);

  return {
    current: current.score,
    previous: previous.score,
    trend: determineTrend(current.score, previous.score),
  };
}

// GET /api/support/feedback-metrics
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "10");
  const customStart = searchParams.get("start_date");
  const customEnd = searchParams.get("end_date");

  // Calculate date ranges
  const now = new Date();
  let endDate = now;
  let startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  if (customStart && customEnd) {
    startDate = new Date(customStart);
    endDate = new Date(customEnd);
  }

  // Previous period for comparison (same length, immediately before)
  const periodLength = endDate.getTime() - startDate.getTime();
  const previousEnd = new Date(startDate.getTime());
  const previousStart = new Date(startDate.getTime() - periodLength);

  try {
    // Fetch feedback records for both periods in parallel
    const [currentResult, previousResult] = await Promise.all([
      supabase
        .from("integration_records")
        .select("properties")
        .eq("organization_id", profile.organization_id)
        .eq("object_type", "feedback_submissions")
        .gte("properties->>hs_submission_timestamp", startDate.toISOString())
        .lt("properties->>hs_submission_timestamp", endDate.toISOString()),
      supabase
        .from("integration_records")
        .select("properties")
        .eq("organization_id", profile.organization_id)
        .eq("object_type", "feedback_submissions")
        .gte("properties->>hs_submission_timestamp", previousStart.toISOString())
        .lt("properties->>hs_submission_timestamp", previousEnd.toISOString()),
    ]);

    if (currentResult.error) {
      console.error("Error fetching current feedback:", currentResult.error);
      return NextResponse.json({ error: "Failed to fetch feedback data" }, { status: 500 });
    }

    if (previousResult.error) {
      console.error("Error fetching previous feedback:", previousResult.error);
      return NextResponse.json({ error: "Failed to fetch feedback data" }, { status: 500 });
    }

    const currentRecords = currentResult.data as FeedbackRecord[];
    const previousRecords = previousResult.data as FeedbackRecord[];

    // Count surveys that have at least one score field filled
    const surveyCount = currentRecords.filter((r) =>
      Object.values(SCORE_FIELDS).some((field) => {
        const val = r.properties[field];
        return val !== null && val !== undefined && val !== "";
      })
    ).length;

    const response: FeedbackMetrics = {
      resolution: buildScoreMetric(currentRecords, previousRecords, SCORE_FIELDS.resolution),
      responseTime: buildScoreMetric(currentRecords, previousRecords, SCORE_FIELDS.responseTime),
      helpfulness: buildScoreMetric(currentRecords, previousRecords, SCORE_FIELDS.helpfulness),
      surveyCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching feedback metrics:", error);
    return NextResponse.json({ error: "Failed to fetch feedback metrics" }, { status: 500 });
  }
}
