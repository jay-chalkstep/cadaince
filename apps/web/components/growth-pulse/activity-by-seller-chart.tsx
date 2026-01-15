"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ActivityBySeller } from "@/types/growth-pulse";

interface ActivityBySellerChartProps {
  data: ActivityBySeller[];
  title: string;
}

export function ActivityBySellerChart({ data, title }: ActivityBySellerChartProps) {
  // Take top 10 sellers by activity
  const chartData = data.slice(0, 10);
  const hasData = chartData.length > 0 && chartData.some(d => d.numNotes > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            No activity data available
          </div>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="ownerName"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={75}
                />
                <Tooltip
                  formatter={(value) => [value, "Notes"]}
                  labelFormatter={(label) => {
                    const item = chartData.find(d => d.ownerName === label);
                    return item ? `${label} (${item.dealCount} deals)` : label;
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar
                  dataKey="numNotes"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
