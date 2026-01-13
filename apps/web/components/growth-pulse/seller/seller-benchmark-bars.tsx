"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { BenchmarkComparison } from "@/types/growth-pulse";
import { formatCurrency } from "@/types/growth-pulse";

interface SellerBenchmarkBarsProps {
  benchmarks: BenchmarkComparison[];
}

export function SellerBenchmarkBars({ benchmarks }: SellerBenchmarkBarsProps) {
  // Format value based on metric type
  const formatValue = (metric: string, value: number): string => {
    if (metric === "Open Deals") {
      return value.toString();
    }
    return formatCurrency(value, true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Team Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {benchmarks.map((item) => {
          // Calculate percentage vs leader (leader = 100%)
          const max = Math.max(item.leader, item.sellerValue);
          const valuePercent = max > 0 ? (item.sellerValue / max) * 100 : 0;
          const avgPercent = max > 0 ? (item.teamAvg / max) * 100 : 0;

          // Calculate vs average percentage
          const vsAvg =
            item.teamAvg > 0
              ? ((item.sellerValue - item.teamAvg) / item.teamAvg) * 100
              : 0;

          return (
            <div key={item.metric} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.metric}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatValue(item.metric, item.sellerValue)}</span>
                  <span
                    className={`text-xs ${
                      vsAvg >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    ({vsAvg >= 0 ? "+" : ""}
                    {vsAvg.toFixed(0)}% vs avg)
                  </span>
                </div>
              </div>
              <div className="relative">
                {/* Background bar */}
                <Progress value={valuePercent} className="h-3" />
                {/* Team average marker */}
                {avgPercent > 0 && avgPercent < 100 && (
                  <div
                    className="absolute top-0 h-3 w-0.5 bg-muted-foreground"
                    style={{ left: `${avgPercent}%` }}
                    title={`Team Avg: ${formatValue(item.metric, item.teamAvg)}`}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Team Avg: {formatValue(item.metric, item.teamAvg)}</span>
                <span>Leader: {formatValue(item.metric, item.leader)}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
