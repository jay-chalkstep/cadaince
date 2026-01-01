"use client";

import { useState, useEffect } from "react";
import {
  ArrowDownRight,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AggregationType = "sum" | "average" | "min" | "max" | "latest" | "manual";

interface RollupIndicatorProps {
  metricId: string;
  aggregationType?: AggregationType | null;
  isRollup?: boolean;
  childCount?: number;
  className?: string;
}

/**
 * Get display label for aggregation type
 */
function getAggregationLabel(type: AggregationType): string {
  switch (type) {
    case "sum":
      return "Sum";
    case "average":
      return "Avg";
    case "min":
      return "Min";
    case "max":
      return "Max";
    case "latest":
      return "Latest";
    case "manual":
      return "Manual";
    default:
      return type;
  }
}

/**
 * Get color for aggregation type badge
 */
function getAggregationColor(type: AggregationType): string {
  switch (type) {
    case "sum":
      return "bg-blue-100 text-blue-800";
    case "average":
      return "bg-green-100 text-green-800";
    case "min":
    case "max":
      return "bg-purple-100 text-purple-800";
    case "latest":
      return "bg-amber-100 text-amber-800";
    case "manual":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * RollupIndicator - Shows that a metric is a rollup with aggregation type
 */
export function RollupIndicator({
  metricId,
  aggregationType,
  isRollup = false,
  childCount = 0,
  className,
}: RollupIndicatorProps) {
  if (!isRollup || !aggregationType) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={cn(
              "gap-1 cursor-help",
              getAggregationColor(aggregationType),
              className
            )}
          >
            <Calculator className="h-3 w-3" />
            {getAggregationLabel(aggregationType)}
            {childCount > 0 && (
              <span className="text-[10px] opacity-75">({childCount})</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            This metric is a rollup of {childCount} child metric{childCount !== 1 && "s"}.
          </p>
          <p className="text-muted-foreground">
            Aggregation: {getAggregationLabel(aggregationType)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Child metric data from API
 */
interface ChildMetric {
  id: string;
  name: string;
  goal: number | null;
  unit: string | null;
  latest_value: number | null;
  latest_recorded_at: string | null;
  team?: { id: string; name: string; level: number } | null;
  owner?: { id: string; full_name: string; avatar_url: string | null } | null;
}

interface RollupTreeProps {
  metricId: string;
  metricName: string;
  aggregationType: AggregationType;
  className?: string;
}

/**
 * RollupTree - Expandable tree showing child metrics
 */
export function RollupTree({
  metricId,
  metricName,
  aggregationType,
  className,
}: RollupTreeProps) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<ChildMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && children.length === 0) {
      const fetchChildren = async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await fetch(`/api/metrics/${metricId}/children`);
          if (!res.ok) throw new Error("Failed to fetch child metrics");
          const data = await res.json();
          setChildren(data.children || []);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
          setLoading(false);
        }
      };
      fetchChildren();
    }
  }, [open, metricId, children.length]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 h-7 px-2">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <ArrowDownRight className="h-3 w-3" />
          <span className="text-xs">View child metrics</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading child metrics...
          </div>
        ) : error ? (
          <div className="text-sm text-destructive p-2">{error}</div>
        ) : children.length === 0 ? (
          <div className="text-sm text-muted-foreground p-2">
            No child metrics
          </div>
        ) : (
          <div className="border rounded-md divide-y">
            {children.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-3 p-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{child.name}</div>
                  {child.team && (
                    <div className="text-xs text-muted-foreground">
                      {child.team.name}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-mono">
                    {child.latest_value !== null
                      ? child.latest_value.toLocaleString()
                      : "—"}
                    {child.unit && (
                      <span className="text-muted-foreground ml-1">
                        {child.unit}
                      </span>
                    )}
                  </div>
                  {child.goal !== null && (
                    <div className="text-xs text-muted-foreground">
                      Goal: {child.goal.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface RollupDialogProps {
  metricId: string;
  metricName: string;
  aggregationType: AggregationType;
  currentValue?: number | null;
  trigger?: React.ReactNode;
}

/**
 * RollupDialog - Dialog showing rollup details and child metrics
 */
export function RollupDialog({
  metricId,
  metricName,
  aggregationType,
  currentValue,
  trigger,
}: RollupDialogProps) {
  const [children, setChildren] = useState<ChildMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchChildren = async () => {
        try {
          setLoading(true);
          const res = await fetch(`/api/metrics/${metricId}/children`);
          if (res.ok) {
            const data = await res.json();
            setChildren(data.children || []);
          }
        } catch {
          // Ignore
        } finally {
          setLoading(false);
        }
      };
      fetchChildren();
    }
  }, [open, metricId]);

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const res = await fetch("/api/metrics/rollup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric_ids: [metricId] }),
      });
      if (res.ok) {
        // Refresh children to get updated values
        const childRes = await fetch(`/api/metrics/${metricId}/children`);
        if (childRes.ok) {
          const data = await childRes.json();
          setChildren(data.children || []);
        }
      }
    } catch {
      // Ignore
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            View Rollup
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {metricName}
          </DialogTitle>
          <DialogDescription>
            This metric aggregates values from {children.length} child metric
            {children.length !== 1 && "s"} using{" "}
            <Badge
              variant="secondary"
              className={cn("mx-1", getAggregationColor(aggregationType))}
            >
              {getAggregationLabel(aggregationType)}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current value */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Current Value</span>
            <span className="text-2xl font-bold">
              {currentValue !== null && currentValue !== undefined
                ? currentValue.toLocaleString()
                : "—"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={recalculating}
            >
              {recalculating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Recalculate
            </Button>
          </div>

          {/* Child metrics table */}
          <div className="border rounded-lg">
            <div className="px-4 py-2 bg-muted/30 border-b">
              <h4 className="font-medium">Child Metrics</h4>
            </div>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : children.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No child metrics
              </div>
            ) : (
              <div className="divide-y max-h-[300px] overflow-y-auto">
                {children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center gap-4 p-3 hover:bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{child.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        {child.team && <span>{child.team.name}</span>}
                        {child.owner && (
                          <>
                            {child.team && <span>•</span>}
                            <span>{child.owner.full_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-lg">
                        {child.latest_value !== null
                          ? child.latest_value.toLocaleString()
                          : "—"}
                      </div>
                      {child.goal !== null && (
                        <div className="text-xs text-muted-foreground">
                          / {child.goal.toLocaleString()} goal
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * AggregationTypeBadge - Standalone badge for aggregation type
 */
export function AggregationTypeBadge({
  type,
  className,
}: {
  type: AggregationType;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1", getAggregationColor(type), className)}
    >
      <Calculator className="h-3 w-3" />
      {getAggregationLabel(type)}
    </Badge>
  );
}
