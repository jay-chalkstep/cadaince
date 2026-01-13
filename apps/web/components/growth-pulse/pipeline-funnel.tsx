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

interface PipelineFunnelProps {
  data: StageBreakdown[];
}

export function PipelineFunnel({ data }: PipelineFunnelProps) {
  // Sort by ARR descending for funnel visualization
  const sortedData = [...data].sort((a, b) => b.totalArr - a.totalArr);

  // Calculate total for percentage
  const totalArr = sortedData.reduce((sum, d) => sum + d.totalArr, 0);

  // Format stage names for display
  const formattedData = sortedData.map((d) => ({
    ...d,
    displayStage: formatStageName(d.stage),
    percentage: totalArr > 0 ? Math.round((d.totalArr / totalArr) * 100) : 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Pipeline by Stage</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            No pipeline data available
          </div>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={formattedData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
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
                  width={75}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
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

// Format stage name for display (convert from HubSpot internal names)
function formatStageName(stage: string): string {
  // Common HubSpot stage mappings
  const stageNames: Record<string, string> = {
    appointmentscheduled: "Scheduled",
    qualifiedtobuy: "Qualified",
    presentationscheduled: "Demo",
    decisionmakerboughtin: "Decision Maker",
    contractsent: "Contract",
    closedwon: "Won",
    closedlost: "Lost",
  };

  const normalized = stage.toLowerCase().replace(/[^a-z]/g, "");
  return stageNames[normalized] || formatLabel(stage);
}

// Generic label formatter
function formatLabel(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
