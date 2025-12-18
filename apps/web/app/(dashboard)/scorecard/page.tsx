"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricDetailSheet } from "@/components/scorecard/metric-detail-sheet";
import { CreateMetricWizard } from "@/components/scorecard/create-metric-wizard";
import { cn } from "@/lib/utils";

interface Metric {
  id: string;
  name: string;
  description: string | null;
  goal: number | null;
  unit: string | null;
  frequency: string;
  metric_type: string;
  time_window: string | null;
  time_windows: string[] | null;
  goals_by_window: Record<string, number> | null;
  thresholds_by_window: Record<string, { yellow: number; red: number }> | null;
  current_value: number | null;
  recorded_at: string | null;
  trend: "up" | "down" | "flat";
  status: "on_track" | "at_risk" | "off_track";
  values_by_window?: Record<string, number | null>;
  status_by_window?: Record<string, "on_track" | "at_risk" | "off_track">;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

const WINDOW_ORDER = ["day", "week", "mtd", "qtd", "ytd", "trailing_7", "trailing_30", "trailing_90"];

const WINDOW_LABELS: Record<string, string> = {
  day: "D",
  week: "W",
  mtd: "M",
  qtd: "Q",
  ytd: "YTD",
  trailing_7: "7D",
  trailing_30: "30D",
  trailing_90: "90D",
};

export default function ScorecardPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchMetrics = async () => {
    try {
      const response = await fetch("/api/metrics");
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  // Determine if we have any multi-window metrics and which windows to display
  const { hasMultiWindow, displayWindows } = useMemo(() => {
    const multiWindowMetrics = metrics.filter(
      (m) => m.metric_type === "multi_window" && m.time_windows?.length
    );

    if (multiWindowMetrics.length === 0) {
      return { hasMultiWindow: false, displayWindows: [] };
    }

    // Collect all unique windows
    const allWindows = new Set<string>();
    multiWindowMetrics.forEach((m) => {
      m.time_windows?.forEach((w) => allWindows.add(w));
    });

    // Sort by standard order
    const sortedWindows = WINDOW_ORDER.filter((w) => allWindows.has(w));

    return { hasMultiWindow: true, displayWindows: sortedWindows };
  }, [metrics]);

  const handleMetricClick = (metric: Metric) => {
    setSelectedMetric(metric);
    setSheetOpen(true);
  };

  const getStatusColor = (status: "on_track" | "at_risk" | "off_track") => {
    switch (status) {
      case "on_track":
        return "text-green-600";
      case "at_risk":
        return "text-yellow-600";
      case "off_track":
        return "text-red-600";
    }
  };

  const getStatusDot = (status: "on_track" | "at_risk" | "off_track") => {
    switch (status) {
      case "on_track":
        return <span className="inline-block w-2 h-2 rounded-full bg-green-500" />;
      case "at_risk":
        return <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />;
      case "off_track":
        return <span className="inline-block w-2 h-2 rounded-full bg-red-500" />;
    }
  };

  const getStatusBadge = (status: "on_track" | "at_risk" | "off_track") => {
    switch (status) {
      case "on_track":
        return <Badge variant="default" className="bg-green-600">On Track</Badge>;
      case "at_risk":
        return <Badge variant="default" className="bg-yellow-500">At Risk</Badge>;
      case "off_track":
        return <Badge variant="destructive">Off Track</Badge>;
    }
  };

  const getTrendIcon = (trend: "up" | "down" | "flat") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case "flat":
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatValue = (value: number | null, unit: string | null) => {
    if (value === null) return "—";
    if (unit === "$") {
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      }
      if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
      }
      return `$${value.toLocaleString()}`;
    }
    if (unit === "%") return `${value}%`;
    return unit ? `${value} ${unit}` : value.toLocaleString();
  };

  // Render a multi-window metric row
  const renderMultiWindowRow = (metric: Metric) => {
    return (
      <TableRow
        key={metric.id}
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => handleMetricClick(metric)}
      >
        <TableCell>
          <div>
            <div className="font-medium">{metric.name}</div>
            {metric.description && (
              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                {metric.description}
              </div>
            )}
          </div>
        </TableCell>

        {/* Render value cells for each display window */}
        {displayWindows.map((window) => {
          const hasWindow = metric.time_windows?.includes(window);
          const value = hasWindow ? (metric.values_by_window?.[window] ?? null) : null;
          const status = hasWindow ? (metric.status_by_window?.[window] ?? null) : null;

          return (
            <TableCell key={window} className="text-right">
              {hasWindow ? (
                <div className="flex items-center justify-end gap-2">
                  <span className={cn("font-mono", status && getStatusColor(status))}>
                    {formatValue(value, metric.unit)}
                  </span>
                  {status && getStatusDot(status)}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
          );
        })}

        <TableCell>
          {metric.owner && (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={metric.owner.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(metric.owner.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{metric.owner.full_name}</span>
            </div>
          )}
        </TableCell>
      </TableRow>
    );
  };

  // Render a standard (non-multi-window) metric row
  const renderStandardRow = (metric: Metric) => {
    if (hasMultiWindow) {
      // If we're showing multi-window columns, render this metric spanning those columns
      return (
        <TableRow
          key={metric.id}
          className="cursor-pointer hover:bg-muted/50"
          onClick={() => handleMetricClick(metric)}
        >
          <TableCell>
            <div>
              <div className="font-medium">{metric.name}</div>
              {metric.description && (
                <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {metric.description}
                </div>
              )}
            </div>
          </TableCell>

          {/* Show value in first window column, empty for rest */}
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
              <span className={cn("font-mono", getStatusColor(metric.status))}>
                {formatValue(metric.current_value, metric.unit)}
              </span>
              {getStatusDot(metric.status)}
            </div>
          </TableCell>

          {displayWindows.slice(1).map((window) => (
            <TableCell key={window} className="text-right">
              <span className="text-muted-foreground">—</span>
            </TableCell>
          ))}

          <TableCell>
            {metric.owner && (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={metric.owner.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(metric.owner.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{metric.owner.full_name}</span>
              </div>
            )}
          </TableCell>
        </TableRow>
      );
    }

    // Standard layout (no multi-window metrics in the list)
    return (
      <TableRow
        key={metric.id}
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => handleMetricClick(metric)}
      >
        <TableCell>
          <div>
            <div className="font-medium">{metric.name}</div>
            {metric.description && (
              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                {metric.description}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          {metric.owner && (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={metric.owner.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(metric.owner.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{metric.owner.full_name}</span>
            </div>
          )}
        </TableCell>
        <TableCell className="text-right font-mono">
          {formatValue(metric.current_value, metric.unit)}
        </TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">
          {formatValue(metric.goal, metric.unit)}
        </TableCell>
        <TableCell className="text-center">
          {getTrendIcon(metric.trend)}
        </TableCell>
        <TableCell className="text-center">
          {getStatusBadge(metric.status)}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scorecard</h1>
          <p className="text-sm text-muted-foreground">
            Track key metrics across the organization
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Metric
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Metric</TableHead>

              {hasMultiWindow ? (
                <>
                  {displayWindows.map((window) => (
                    <TableHead key={window} className="text-right w-24">
                      {WINDOW_LABELS[window] || window}
                    </TableHead>
                  ))}
                  <TableHead>Owner</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Goal</TableHead>
                  <TableHead className="text-center">Trend</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  {hasMultiWindow ? (
                    <>
                      {displayWindows.map((w) => (
                        <TableCell key={w}><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      ))}
                      <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-5 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 mx-auto" /></TableCell>
                    </>
                  )}
                </TableRow>
              ))
            ) : metrics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={hasMultiWindow ? displayWindows.length + 2 : 6} className="h-24 text-center">
                  <div className="text-muted-foreground">
                    <p>No metrics yet.</p>
                    <p className="text-sm">Add your first metric to get started.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              metrics.map((metric) => {
                if (metric.metric_type === "multi_window") {
                  return renderMultiWindowRow(metric);
                }
                return renderStandardRow(metric);
              })
            )}
          </TableBody>
        </Table>
      </div>

      <MetricDetailSheet
        metric={selectedMetric}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={fetchMetrics}
      />

      <CreateMetricWizard
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={fetchMetrics}
      />
    </div>
  );
}
