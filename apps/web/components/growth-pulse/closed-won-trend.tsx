"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { ClosedWonTrendItem } from "@/types/growth-pulse";
import { formatCurrency } from "@/types/growth-pulse";

interface ClosedWonTrendProps {
  data: ClosedWonTrendItem[];
}

export function ClosedWonTrend({ data }: ClosedWonTrendProps) {
  // Format dates for display
  const formattedData = data.map((d) => ({
    ...d,
    displayDate: formatDate(d.date),
  }));

  // Calculate cumulative total
  let cumulative = 0;
  const cumulativeData = formattedData.map((d) => {
    cumulative += d.totalArr;
    return {
      ...d,
      cumulativeArr: cumulative,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Closed Won Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            No closed won deals in this period
          </div>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={cumulativeData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value, true)}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(value as number),
                    name === "cumulativeArr" ? "Cumulative ARR" : "Daily ARR",
                  ]}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeArr"
                  name="cumulativeArr"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
