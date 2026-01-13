"use client";

import { ThumbsUp, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeedbackMetrics } from "@/types/support-pulse";

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

function TrendArrow({ trend }: { trend: "up" | "down" | "neutral" }) {
  if (trend === "up") {
    return <TrendingUp className="h-5 w-5 text-green-600" />;
  }
  if (trend === "down") {
    return <TrendingDown className="h-5 w-5 text-red-600" />;
  }
  return <Minus className="h-5 w-5 text-muted-foreground" />;
}

export function FeedbackScoreCard({ data, loading }: FeedbackScoreCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Feedback Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[250px]">
            <div className="text-center space-y-4">
              <Skeleton className="h-16 w-24 mx-auto" />
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const score = data?.currentScore;
  const surveyCount = data?.surveyCount ?? 0;
  const trend = data?.trend ?? "neutral";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          Feedback Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-[250px]">
          {surveyCount === 0 ? (
            <div className="text-center text-muted-foreground">
              <ThumbsUp className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No feedback data</p>
              <p className="text-sm">for this period</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={`text-6xl font-bold ${getScoreColor(score ?? null)}`}>
                  {score != null ? score.toFixed(1) : "—"}
                </span>
                <div className="flex flex-col items-start">
                  <TrendArrow trend={trend} />
                  <span className="text-sm text-muted-foreground">/10</span>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                from {surveyCount.toLocaleString()} survey{surveyCount !== 1 ? "s" : ""}
              </p>
              {data?.previousScore != null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Previous: {data.previousScore.toFixed(1)}
                </p>
              )}
              <div className="mt-4 flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground mr-2">&lt;7</span>
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-xs text-muted-foreground mr-2">7-8</span>
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">&gt;8</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
