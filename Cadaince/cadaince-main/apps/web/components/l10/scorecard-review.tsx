"use client";

import { TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Metric {
  id: string;
  name: string;
  current_value: number | null;
  goal: number | null;
  unit: string | null;
  owner?: {
    id: string;
    full_name: string;
  };
}

interface ScorecardReviewProps {
  metrics: Metric[];
}

export function ScorecardReview({ metrics }: ScorecardReviewProps) {
  const formatValue = (value: number | null, unit: string | null) => {
    if (value === null) return "—";
    if (unit === "%") return `${value}%`;
    if (unit === "$") return `$${value.toLocaleString()}`;
    return unit ? `${value} ${unit}` : value.toString();
  };

  const getStatus = (current: number | null, goal: number | null) => {
    if (current === null || goal === null) return "unknown";
    const ratio = current / goal;
    if (ratio >= 1) return "on_track";
    if (ratio >= 0.8) return "at_risk";
    return "off_track";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "on_track":
        return (
          <Badge className="bg-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            On Track
          </Badge>
        );
      case "at_risk":
        return (
          <Badge className="bg-yellow-500">
            <Minus className="mr-1 h-3 w-3" />
            At Risk
          </Badge>
        );
      case "off_track":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Off Track
          </Badge>
        );
      default:
        return <Badge variant="outline">—</Badge>;
    }
  };

  if (metrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No metrics to review
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review each metric. Flag any that need discussion.
      </p>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Goal</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((metric) => {
              const status = getStatus(metric.current_value, metric.goal);
              return (
                <TableRow key={metric.id}>
                  <TableCell className="font-medium">{metric.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {metric.owner?.full_name || "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatValue(metric.current_value, metric.unit)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatValue(metric.goal, metric.unit)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(status)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-green-600" />
          <span className="text-muted-foreground">On Track</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-yellow-500" />
          <span className="text-muted-foreground">At Risk</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-muted-foreground">Off Track</span>
        </div>
      </div>
    </div>
  );
}
