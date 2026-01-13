"use client";

import { useEffect, useState } from "react";
import { SummaryCards } from "./summary-cards";
import { PipelineFunnel } from "./pipeline-funnel";
import { ClosedWonTrend } from "./closed-won-trend";
import { SellerTable } from "./seller-table";
import { DashboardSkeleton } from "./dashboard-skeleton";
import type {
  GrowthPulseMetrics,
  StageBreakdown,
  ClosedWonTrendItem,
  SellerSummary,
  OrgBenchmarks,
} from "@/types/growth-pulse";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardData {
  metrics: GrowthPulseMetrics;
  stageBreakdown: StageBreakdown[];
  closedWonTrend: ClosedWonTrendItem[];
  sellers: SellerSummary[];
  benchmarks: OrgBenchmarks;
}

export function GrowthPulseDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);

      // Fetch metrics and sellers in parallel
      const [metricsRes, sellersRes] = await Promise.all([
        fetch("/api/growth-pulse/metrics"),
        fetch("/api/growth-pulse/sellers"),
      ]);

      if (!metricsRes.ok) {
        const err = await metricsRes.json();
        throw new Error(err.error || "Failed to fetch metrics");
      }

      if (!sellersRes.ok) {
        const err = await sellersRes.json();
        throw new Error(err.error || "Failed to fetch sellers");
      }

      const metricsData = await metricsRes.json();
      const sellersData = await sellersRes.json();

      setData({
        metrics: metricsData.summary,
        stageBreakdown: metricsData.pipelineByStage,
        closedWonTrend: metricsData.closedWonTrend,
        sellers: sellersData.sellers,
        benchmarks: sellersData.benchmarks,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/growth-pulse/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_type: "full" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to trigger sync");
      }

      // Wait a moment then refresh data
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-4">
          No pipeline data available. Sync your HubSpot deals to get started.
        </p>
        <Button onClick={triggerSync} disabled={syncing}>
          {syncing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Now
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCards metrics={data.metrics} />

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <PipelineFunnel data={data.stageBreakdown} />
        <ClosedWonTrend data={data.closedWonTrend} />
      </div>

      {/* Sellers Table */}
      <SellerTable sellers={data.sellers} benchmarks={data.benchmarks} />
    </div>
  );
}
