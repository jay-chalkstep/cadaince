"use client";

import { useEffect, useState } from "react";
import { Plus, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
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
import { CreateMetricDialog } from "@/components/scorecard/create-metric-dialog";

interface Metric {
  id: string;
  name: string;
  description: string | null;
  goal: number | null;
  unit: string | null;
  frequency: string;
  current_value: number | null;
  recorded_at: string | null;
  trend: "up" | "down" | "flat";
  status: "on_track" | "at_risk" | "off_track";
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

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

  const handleMetricClick = (metric: Metric) => {
    setSelectedMetric(metric);
    setSheetOpen(true);
  };

  const getStatusBadge = (status: Metric["status"]) => {
    switch (status) {
      case "on_track":
        return <Badge variant="default" className="bg-green-600">On Track</Badge>;
      case "at_risk":
        return <Badge variant="default" className="bg-yellow-500">At Risk</Badge>;
      case "off_track":
        return <Badge variant="destructive">Off Track</Badge>;
    }
  };

  const getTrendIcon = (trend: Metric["trend"]) => {
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
    if (unit === "%") return `${value}%`;
    if (unit === "$") return `$${value.toLocaleString()}`;
    return unit ? `${value} ${unit}` : value.toString();
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
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Goal</TableHead>
              <TableHead className="text-center">Trend</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-5 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : metrics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="text-muted-foreground">
                    <p>No metrics yet.</p>
                    <p className="text-sm">Add your first metric to get started.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              metrics.map((metric) => (
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
              ))
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

      <CreateMetricDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={fetchMetrics}
      />
    </div>
  );
}
