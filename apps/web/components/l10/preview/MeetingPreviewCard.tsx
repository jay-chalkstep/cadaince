"use client";

import { AlertCircle, Target, TrendingDown, CheckSquare, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MeetingPreviewCardProps {
  queuedIssuesCount: number;
  offTrackRocksCount: number;
  belowGoalMetricsCount: number;
  carryoverTodosCount: number;
  onAddIssue: () => void;
}

export function MeetingPreviewCard({
  queuedIssuesCount,
  offTrackRocksCount,
  belowGoalMetricsCount,
  carryoverTodosCount,
  onAddIssue,
}: MeetingPreviewCardProps) {
  const stats = [
    {
      label: "Issues Queued",
      count: queuedIssuesCount,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      label: "Rocks Off-Track",
      count: offTrackRocksCount,
      icon: Target,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      label: "Metrics Below Goal",
      count: belowGoalMetricsCount,
      icon: TrendingDown,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Carryover To-Dos",
      count: carryoverTodosCount,
      icon: CheckSquare,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
  ];

  const totalItems = queuedIssuesCount + offTrackRocksCount + belowGoalMetricsCount + carryoverTodosCount;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Meeting Preview</CardTitle>
          <Button variant="outline" size="sm" onClick={onAddIssue}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Issue
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {totalItems === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">Looking good! No issues queued yet.</p>
            <p className="text-xs mt-1">Add anything you want to discuss in the meeting.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={`flex flex-col items-center justify-center rounded-lg p-3 ${stat.bgColor}`}
                >
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                  <span className={`mt-1 text-2xl font-bold ${stat.color}`}>
                    {stat.count}
                  </span>
                  <span className="text-xs text-muted-foreground text-center">
                    {stat.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
