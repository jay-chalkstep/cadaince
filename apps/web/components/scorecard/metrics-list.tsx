"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { MetricDetailSheet } from "@/components/scorecard/metric-detail-sheet";
import { CreateMetricWizard } from "@/components/scorecard/create-metric-wizard";
import { RollupIndicator } from "@/components/scorecard/rollup-indicator";
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
  team?: {
    id: string;
    name: string;
    level?: number;
  } | null;
  is_rollup?: boolean;
  aggregation_type?: "sum" | "average" | "min" | "max" | "latest" | "manual" | null;
  child_count?: number;
}

interface MetricsListProps {
  teamId?: string;
  showTeamBadge?: boolean;
  showHeader?: boolean;
  compact?: boolean;
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

export function MetricsList({
  teamId,
  showTeamBadge = false,
  showHeader = true,
  compact = false,
}: MetricsListProps) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      let url = "/api/metrics";
      if (teamId) {
        url += `?team_id=${teamId}`;
      }
      const response = await fetch(url);
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
  }, [teamId]);

  // Determine if we have any multi-window metrics and which windows to display
  const { hasMultiWindow, displayWindows } = useMemo(() => {
    const multiWindowMetrics = metrics.filter(
      (m) => m.metric_type === "multi_window" && m.time_windows?.length
    );

    if (multiWindowMetrics.length === 0) {
      return { hasMultiWindow: false, displayWindows: [] };
    }

    const allWindows = new Set<string>();
    multiWindowMetrics.forEach((m) => {
      m.time_windows?.forEach((w) => allWindows.add(w));
    });

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

  if (loading) {
    return (
      <div className="space-y-4">
        {showHeader && (
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-10 w-28" />
          </div>
        )}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]"><Skeleton className="h-4 w-16" /></TableHead>
                <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                <TableHead className="text-right"><Skeleton className="h-4 w-16" /></TableHead>
                <TableHead className="text-right"><Skeleton className="h-4 w-16" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: compact ? 3 : 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Scorecard</h2>
            <p className="text-sm text-muted-foreground">
              Track key metrics
            </p>
          </div>
          <Button size={compact ? "sm" : "default"} onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Metric
          </Button>
        </div>
      )}

      {metrics.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No metrics yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              {teamId ? "This team has no metrics." : "Add your first metric to get started."}
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Metric
            </Button>
          </CardContent>
        </Card>
      ) : (
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
              {metrics.map((metric) => {
                if (metric.metric_type === "multi_window") {
                  return renderMultiWindowRow(metric);
                }
                return renderStandardRow(metric);
              })}
            </TableBody>
          </Table>
        </div>
      )}

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
        defaultTeamId={teamId}
      />
    </div>
  );

  function renderMultiWindowRow(metric: Metric) {
    return (
      <TableRow
        key={metric.id}
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => handleMetricClick(metric)}
      >
        <TableCell>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-medium ${compact ? "text-sm" : ""}`}>{metric.name}</span>
              <RollupIndicator
                metricId={metric.id}
                aggregationType={metric.aggregation_type}
                isRollup={metric.is_rollup}
                childCount={metric.child_count}
              />
              {showTeamBadge && metric.team && (
                <Badge variant="secondary" className="text-xs">
                  {metric.team.name}
                </Badge>
              )}
            </div>
            {!compact && metric.description && (
              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                {metric.description}
              </div>
            )}
          </div>
        </TableCell>

        {displayWindows.map((window) => {
          const hasWindow = metric.time_windows?.includes(window);
          const value = hasWindow ? (metric.values_by_window?.[window] ?? null) : null;
          const status = hasWindow ? (metric.status_by_window?.[window] ?? null) : null;

          return (
            <TableCell key={window} className="text-right">
              {hasWindow ? (
                <div className="flex items-center justify-end gap-2">
                  <span className={cn("font-mono text-sm", status && getStatusColor(status))}>
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
              <Avatar className={compact ? "h-6 w-6" : "h-8 w-8"}>
                <AvatarImage src={metric.owner.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(metric.owner.full_name)}
                </AvatarFallback>
              </Avatar>
              {!compact && <span className="text-sm">{metric.owner.full_name}</span>}
            </div>
          )}
        </TableCell>
      </TableRow>
    );
  }

  function renderStandardRow(metric: Metric) {
    if (hasMultiWindow) {
      return (
        <TableRow
          key={metric.id}
          className="cursor-pointer hover:bg-muted/50"
          onClick={() => handleMetricClick(metric)}
        >
          <TableCell>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${compact ? "text-sm" : ""}`}>{metric.name}</span>
                <RollupIndicator
                  metricId={metric.id}
                  aggregationType={metric.aggregation_type}
                  isRollup={metric.is_rollup}
                  childCount={metric.child_count}
                />
                {showTeamBadge && metric.team && (
                  <Badge variant="secondary" className="text-xs">
                    {metric.team.name}
                  </Badge>
                )}
              </div>
              {!compact && metric.description && (
                <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {metric.description}
                </div>
              )}
            </div>
          </TableCell>

          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
              <span className={cn("font-mono text-sm", getStatusColor(metric.status))}>
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
                <Avatar className={compact ? "h-6 w-6" : "h-8 w-8"}>
                  <AvatarImage src={metric.owner.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(metric.owner.full_name)}
                  </AvatarFallback>
                </Avatar>
                {!compact && <span className="text-sm">{metric.owner.full_name}</span>}
              </div>
            )}
          </TableCell>
        </TableRow>
      );
    }

    return (
      <TableRow
        key={metric.id}
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => handleMetricClick(metric)}
      >
        <TableCell>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-medium ${compact ? "text-sm" : ""}`}>{metric.name}</span>
              <RollupIndicator
                metricId={metric.id}
                aggregationType={metric.aggregation_type}
                isRollup={metric.is_rollup}
                childCount={metric.child_count}
              />
              {showTeamBadge && metric.team && (
                <Badge variant="secondary" className="text-xs">
                  {metric.team.name}
                </Badge>
              )}
            </div>
            {!compact && metric.description && (
              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                {metric.description}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          {metric.owner && (
            <div className="flex items-center gap-2">
              <Avatar className={compact ? "h-6 w-6" : "h-8 w-8"}>
                <AvatarImage src={metric.owner.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(metric.owner.full_name)}
                </AvatarFallback>
              </Avatar>
              {!compact && <span className="text-sm">{metric.owner.full_name}</span>}
            </div>
          )}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {formatValue(metric.current_value, metric.unit)}
        </TableCell>
        <TableCell className="text-right font-mono text-sm text-muted-foreground">
          {formatValue(metric.goal, metric.unit)}
        </TableCell>
        <TableCell className="text-center">
          {getTrendIcon(metric.trend)}
        </TableCell>
        <TableCell className="text-center">
          {compact ? getStatusDot(metric.status) : getStatusBadge(metric.status)}
        </TableCell>
      </TableRow>
    );
  }
}
