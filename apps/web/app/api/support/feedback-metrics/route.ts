import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { FeedbackMetrics } from "@/types/support-pulse";

const SCORE_FIELD = "how_satisfied_are_you_with_the_resolution_of_your_issue_";
const TREND_THRESHOLD = 0.2;

interface FeedbackRecord {
  properties: Record<string, unknown>;
}

function calculateAverageScore(records: FeedbackRecord[]): { score: number | null; count: number } {
  let total = 0;
  let count = 0;

  for (const record of records) {
    const scoreValue = record.properties[SCORE_FIELD];
    if (scoreValue !== null && scoreValue !== undefined && scoreValue !== "") {
      const score = parseFloat(String(scoreValue));
      if (!isNaN(score) && score >= 1 && score <= 10) {
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

    const currentStats = calculateAverageScore(currentResult.data as FeedbackRecord[]);
    const previousStats = calculateAverageScore(previousResult.data as FeedbackRecord[]);

    const response: FeedbackMetrics = {
      currentScore: currentStats.score,
      previousScore: previousStats.score,
      surveyCount: currentStats.count,
      trend: determineTrend(currentStats.score, previousStats.score),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching feedback metrics:", error);
    return NextResponse.json({ error: "Failed to fetch feedback metrics" }, { status: 500 });
  }
}
