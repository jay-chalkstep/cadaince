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
import type { CategoryBreakdown } from "@/types/support-pulse";

interface CategoryChartProps {
  data: CategoryBreakdown[];
  onCategoryClick?: (category: string) => void;
}

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(0, 84%, 60%)",
  "hsl(180, 60%, 50%)",
  "hsl(320, 70%, 55%)",
  "hsl(60, 70%, 50%)",
];

export function CategoryChart({ data, onCategoryClick }: CategoryChartProps) {
  // Take top 8 categories
  const chartData = data.slice(0, 8).map((d) => ({
    ...d,
    // Truncate long category names
    displayCategory: d.category.length > 20 ? d.category.slice(0, 18) + "..." : d.category,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">By Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 0, right: 20 }}
              >
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="displayCategory"
                  tick={{ fontSize: 11 }}
                  width={100}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value, _name, props) => {
                    const payload = props.payload as CategoryBreakdown & { displayCategory: string };
                    return [`${value} (${payload.percentage}%)`, payload.category];
                  }}
                />
                <Bar
                  dataKey="count"
                  cursor={onCategoryClick ? "pointer" : undefined}
                  onClick={(data) => {
                    const payload = data as unknown as CategoryBreakdown;
                    onCategoryClick?.(payload.category);
                  }}
                  radius={[0, 4, 4, 0]}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
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
