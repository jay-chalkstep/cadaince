"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { SellerDetail, OrgBenchmarks } from "@/types/growth-pulse";
import { formatCurrency } from "@/types/growth-pulse";

interface SellerBenchmarkBarsProps {
  seller: SellerDetail;
  benchmarks: OrgBenchmarks;
}

interface BenchmarkItem {
  label: string;
  value: number;
  teamAvg: number;
  leader: number;
  format: (v: number) => string;
}

export function SellerBenchmarkBars({ seller, benchmarks }: SellerBenchmarkBarsProps) {
  const items: BenchmarkItem[] = [
    {
      label: "Open Pipeline",
      value: seller.openPipelineArr,
      teamAvg: benchmarks.avgOpenPipeline,
      leader: benchmarks.leaderOpenPipeline,
      format: (v) => formatCurrency(v, true),
    },
    {
      label: "Closed Won QTD",
      value: seller.closedWonQtdArr,
      teamAvg: benchmarks.avgClosedWonQtd,
      leader: benchmarks.leaderClosedWonQtd,
      format: (v) => formatCurrency(v, true),
    },
    {
      label: "Open Deals",
      value: seller.openDealCount,
      teamAvg: benchmarks.avgOpenDeals,
      leader: benchmarks.leaderOpenDeals,
      format: (v) => v.toString(),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Team Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {items.map((item) => {
          // Calculate percentage vs leader (leader = 100%)
          const max = Math.max(item.leader, item.value);
          const valuePercent = max > 0 ? (item.value / max) * 100 : 0;
          const avgPercent = max > 0 ? (item.teamAvg / max) * 100 : 0;

          // Calculate vs average percentage
          const vsAvg =
            item.teamAvg > 0
              ? ((item.value - item.teamAvg) / item.teamAvg) * 100
              : 0;

          return (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{item.format(item.value)}</span>
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
                    title={`Team Avg: ${item.format(item.teamAvg)}`}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Team Avg: {item.format(item.teamAvg)}</span>
                <span>Leader: {item.format(item.leader)}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
