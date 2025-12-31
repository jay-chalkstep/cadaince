"use client";

import { TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { PreviewSection } from "./PreviewSection";

interface BelowGoalMetric {
  id: string;
  name: string;
  goal: number;
  unit: string | null;
  current_value: number | null;
  threshold_red: number | null;
  threshold_yellow: number | null;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface BelowGoalMetricsListProps {
  metrics: BelowGoalMetric[];
}

export function BelowGoalMetricsList({ metrics }: BelowGoalMetricsListProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (metric: BelowGoalMetric) => {
    if (metric.current_value === null) return "bg-gray-100 text-gray-700";
    if (metric.threshold_red !== null && metric.current_value < metric.threshold_red) {
      return "bg-red-100 text-red-700";
    }
    if (metric.threshold_yellow !== null && metric.current_value < metric.threshold_yellow) {
      return "bg-yellow-100 text-yellow-700";
    }
    return "bg-orange-100 text-orange-700";
  };

  const formatValue = (value: number | null, unit: string | null) => {
    if (value === null) return "—";
    const formatted = value.toLocaleString();
    if (unit === "%") return `${formatted}%`;
    if (unit === "$") return `$${formatted}`;
    return unit ? `${formatted} ${unit}` : formatted;
  };

  const getProgress = (current: number | null, goal: number) => {
    if (current === null || goal === 0) return 0;
    return Math.min(100, Math.max(0, (current / goal) * 100));
  };

  return (
    <PreviewSection
      title="Metrics Below Goal"
      count={metrics.length}
      icon={<TrendingDown className="h-4 w-4 text-orange-600" />}
      defaultExpanded={false}
    >
      <div className="space-y-3">
        {metrics.map((metric) => {
          const owner = Array.isArray(metric.owner) ? metric.owner[0] : metric.owner;
          const progress = getProgress(metric.current_value, metric.goal);

          return (
            <div
              key={metric.id}
              className="p-3 rounded-lg border bg-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm">{metric.name}</h4>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {owner && (
                      <>
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={owner.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px]">
                            {getInitials(owner.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{owner.full_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <Badge className={getStatusColor(metric)}>
                  {formatValue(metric.current_value, metric.unit)}
                </Badge>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>Goal: {formatValue(metric.goal, metric.unit)}</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            </div>
          );
        })}
      </div>
    </PreviewSection>
  );
}
