"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { StageBreakdown } from "@/types/growth-pulse";
import { formatCurrency, getStageColor } from "@/types/growth-pulse";

interface SellerStageChartProps {
  data: StageBreakdown[];
}

export function SellerStageChart({ data }: SellerStageChartProps) {
  // Sort by ARR descending
  const sortedData = [...data].sort((a, b) => b.totalArr - a.totalArr);

  // Format stage names for display
  const formattedData = sortedData.map((d) => ({
    ...d,
    displayStage: formatStageName(d.stage),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Pipeline by Stage</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            No open pipeline
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={formattedData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(value) => formatCurrency(value, true)}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="displayStage"
                  tick={{ fontSize: 11 }}
                  width={55}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="totalArr" name="ARR" radius={[0, 4, 4, 0]}>
                  {formattedData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getStageColor(entry.stage)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Format stage name for display
function formatStageName(stage: string): string {
  const stageNames: Record<string, string> = {
    appointmentscheduled: "Scheduled",
    qualifiedtobuy: "Qualified",
    presentationscheduled: "Demo",
    decisionmakerboughtin: "Decision",
    contractsent: "Contract",
    closedwon: "Won",
    closedlost: "Lost",
  };

  const normalized = stage.toLowerCase().replace(/[^a-z]/g, "");
  return stageNames[normalized] || formatLabel(stage);
}

function formatLabel(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
