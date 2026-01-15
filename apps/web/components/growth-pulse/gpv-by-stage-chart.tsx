"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { GpvStageBreakdown } from "@/types/growth-pulse";
import { formatCurrency } from "@/types/growth-pulse";

interface GpvByStageChartProps {
  data: GpvStageBreakdown[];
  title: string;
  dataKey: "gpvFullYear" | "gpvInCurrentYear" | "dealCount" | "gpByStage";
  valueType?: "currency" | "number";
  onStageClick?: (stage: GpvStageBreakdown) => void;
}

// Custom clickable dot component
interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: GpvStageBreakdown;
  onStageClick?: (stage: GpvStageBreakdown) => void;
}

function ClickableDot({ cx, cy, payload, onStageClick }: CustomDotProps) {
  if (!cx || !cy || !payload) return null;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={8}
      fill="hsl(var(--primary))"
      stroke="white"
      strokeWidth={2}
      style={{ cursor: onStageClick ? "pointer" : "default" }}
      onClick={() => onStageClick?.(payload)}
    />
  );
}

export function GpvByStageChart({ data, title, dataKey, valueType = "currency", onStageClick }: GpvByStageChartProps) {
  // Data is already sorted by order from the API
  const chartData = data.map((d) => ({
    ...d,
    value: d[dataKey],
  }));

  const hasData = chartData.some((d) => d.value > 0);

  // Generate unique gradient ID based on dataKey to avoid conflicts
  const gradientId = `colorGpv-${dataKey}`;

  // Format value based on valueType
  const formatValue = (value: number, compact = false) => {
    if (valueType === "number") {
      return value.toLocaleString();
    }
    return formatCurrency(value, compact);
  };

  // Get tooltip label based on dataKey
  const getTooltipLabel = () => {
    switch (dataKey) {
      case "dealCount":
        return "Deals";
      case "gpByStage":
        return "Gross Profit";
      default:
        return "GPV";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            No GPV data available
          </div>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) => formatValue(value, true)}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value) => [formatValue(value as number), getTooltipLabel()]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      const item = payload[0].payload as GpvStageBreakdown;
                      return `${item.stageLabel} (${item.dealCount} deals)`;
                    }
                    return label;
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  dot={onStageClick ? (props) => <ClickableDot {...props} onStageClick={onStageClick} /> : false}
                  activeDot={onStageClick ? (props) => <ClickableDot {...props} onStageClick={onStageClick} /> : { r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
