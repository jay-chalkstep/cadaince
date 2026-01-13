"use client";

import { ThumbsUp, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeedbackMetrics, ScoreMetric } from "@/types/support-pulse";

interface FeedbackScoreCardProps {
  data: FeedbackMetrics | null;
  loading?: boolean;
}

function getScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 8) return "text-green-600";
  if (score >= 7) return "text-yellow-600";
  return "text-red-600";
}

function TrendArrow({ trend, size = "sm" }: { trend: "up" | "down" | "neutral"; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  if (trend === "up") {
    return <TrendingUp className={`${sizeClass} text-green-600`} />;
  }
  if (trend === "down") {
    return <TrendingDown className={`${sizeClass} text-red-600`} />;
  }
  return <Minus className={`${sizeClass} text-muted-foreground`} />;
}

function ScoreColumn({
  label,
  metric,
  loading,
}: {
  label: string;
  metric: ScoreMetric | undefined;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center">
        <span className="text-xs text-muted-foreground mb-1">{label}</span>
        <Skeleton className="h-10 w-14" />
      </div>
    );
  }

  const score = metric?.current;
  const trend = metric?.trend ?? "neutral";

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      <div className="flex items-center gap-1">
        <span className={`text-3xl font-bold ${getScoreColor(score ?? null)}`}>
          {score != null ? score.toFixed(1) : "—"}
        </span>
        <TrendArrow trend={trend} size="sm" />
      </div>
    </div>
  );
}

export function FeedbackScoreCard({ data, loading }: FeedbackScoreCardProps) {
  const surveyCount = data?.surveyCount ?? 0;
  const hasData = !loading && surveyCount > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          Feedback Scores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-[250px]">
          {loading ? (
            <div className="flex items-center justify-around w-full">
              <ScoreColumn label="Resolution" metric={undefined} loading />
              <ScoreColumn label="Response Time" metric={undefined} loading />
              <ScoreColumn label="Helpfulness" metric={undefined} loading />
            </div>
          ) : !hasData ? (
            <div className="text-center text-muted-foreground">
              <ThumbsUp className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No feedback data</p>
              <p className="text-sm">for this period</p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-around w-full">
                <ScoreColumn label="Resolution" metric={data?.resolution} />
                <ScoreColumn label="Response Time" metric={data?.responseTime} />
                <ScoreColumn label="Helpfulness" metric={data?.helpfulness} />
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                from {surveyCount.toLocaleString()} survey{surveyCount !== 1 ? "s" : ""}
              </p>
              <div className="mt-3 flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground mr-2">&lt;7</span>
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs text-muted-foreground mr-2">7-8</span>
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">&gt;8</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
