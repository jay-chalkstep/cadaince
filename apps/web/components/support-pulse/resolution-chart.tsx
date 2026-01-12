"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import type { ResolutionBucket } from "@/types/support-pulse";

interface ResolutionChartProps {
  data: ResolutionBucket[];
}

// Gradient from green (fast) to red (slow)
const BUCKET_COLORS: Record<string, string> = {
  "< 1 hr": "hsl(142, 71%, 45%)",
  "1-4 hr": "hsl(90, 65%, 50%)",
  "4-24 hr": "hsl(38, 92%, 50%)",
  "1-3 days": "hsl(25, 95%, 53%)",
  "3+ days": "hsl(0, 84%, 60%)",
};

export function ResolutionChart({ data }: ResolutionChartProps) {
  const hasData = data.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Resolution Time Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          {!hasData ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No closed tickets with resolution data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value, _name, props) => {
                    const payload = props.payload as ResolutionBucket;
                    return [`${value} tickets (${payload.percentage}%)`, "Count"];
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.map((entry) => (
                    <Cell
                      key={entry.bucket}
                      fill={BUCKET_COLORS[entry.bucket] || "hsl(var(--primary))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
