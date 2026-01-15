"use client";

import { useEffect, useState, useCallback } from "react";
import { SummaryCards, type VelocityDays } from "./summary-cards";
import { GpvByStageChart } from "./gpv-by-stage-chart";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { StageDealsSheet } from "./stage-deals-sheet";
import type {
  GrowthPulseMetrics,
  GpvStageBreakdown,
} from "@/types/growth-pulse";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface DashboardData {
  metrics: GrowthPulseMetrics;
  gpvByStage: GpvStageBreakdown[];
}

interface SyncStatus {
  lastSyncAt: string | null;
  lastSyncStatus: "success" | "error" | "running" | null;
  lastSyncError: string | null;
  entityStatuses: Record<
    string,
    {
      lastSyncAt: string | null;
      lastSyncStatus: string | null;
      recordsFetched: number | null;
    }
  >;
}

export function GrowthPulseDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [selectedStage, setSelectedStage] = useState<GpvStageBreakdown | null>(null);
  const [dealsSheetOpen, setDealsSheetOpen] = useState(false);
  const [velocityDays, setVelocityDays] = useState<VelocityDays>(7);

  const handleStageClick = useCallback((stage: GpvStageBreakdown) => {
    setSelectedStage(stage);
    setDealsSheetOpen(true);
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/growth-pulse/sync");
      if (res.ok) {
        const data = await res.json();
        const entityStatuses: SyncStatus["entityStatuses"] = {};

        // Build entity statuses from lastSyncByType
        if (data.lastSyncByType) {
          for (const [entityType, status] of Object.entries(data.lastSyncByType)) {
            const s = status as {
              lastSyncAt?: string;
              lastSyncStatus?: string;
              recordsFetched?: number;
            };
            entityStatuses[entityType] = {
              lastSyncAt: s.lastSyncAt || null,
              lastSyncStatus: s.lastSyncStatus || null,
              recordsFetched: s.recordsFetched ?? null,
            };
          }
        }

        // Find the most recent sync across all entity types
        const allSyncs = Object.values(entityStatuses).filter((s) => s.lastSyncAt);
        const mostRecent = allSyncs.sort((a, b) =>
          new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime()
        )[0];

        const hasError = Object.values(entityStatuses).some(
          (s) => s.lastSyncStatus === "error"
        );

        setSyncStatus({
          lastSyncAt: mostRecent?.lastSyncAt || null,
          lastSyncStatus: hasError ? "error" : mostRecent?.lastSyncStatus as SyncStatus["lastSyncStatus"] || null,
          lastSyncError: hasError ? "One or more syncs failed" : null,
          entityStatuses,
        });
      }
    } catch {
      // Ignore sync status errors
    }
  }, []);

  const fetchData = useCallback(async (days: VelocityDays) => {
    try {
      setError(null);

      const metricsRes = await fetch(`/api/growth-pulse/metrics?velocity_days=${days}`);

      if (!metricsRes.ok) {
        const err = await metricsRes.json();
        throw new Error(err.error || "Failed to fetch metrics");
      }

      const metricsData = await metricsRes.json();

      setData({
        metrics: metricsData.summary,
        gpvByStage: metricsData.gpvByStage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

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

      // Wait a moment then refresh data and sync status
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await Promise.all([fetchData(velocityDays), fetchSyncStatus()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleVelocityDaysChange = useCallback((days: VelocityDays) => {
    setVelocityDays(days);
    fetchData(days);
  }, [fetchData]);

  useEffect(() => {
    fetchData(velocityDays);
    fetchSyncStatus();
  }, [fetchSyncStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => fetchData(velocityDays)}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Check if we have actual data (not just zeros from empty views)
  const hasNoData = !data || (
    data.metrics.openDeals === 0 &&
    data.gpvByStage.length === 0
  );

  if (hasNoData) {
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
      {/* Sync Status Bar */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {syncStatus?.lastSyncAt ? (
            <>
              {syncStatus.lastSyncStatus === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : syncStatus.lastSyncStatus === "error" ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : syncStatus.lastSyncStatus === "running" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              <span>
                Last synced{" "}
                {formatDistanceToNow(new Date(syncStatus.lastSyncAt), {
                  addSuffix: true,
                })}
              </span>
              {syncStatus.lastSyncStatus === "error" && (
                <span className="text-destructive">
                  ({syncStatus.lastSyncError})
                </span>
              )}
            </>
          ) : (
            <>
              <Clock className="h-4 w-4" />
              <span>No sync history</span>
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={triggerSync}
          disabled={syncing}
        >
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

      {/* Summary Cards */}
      <SummaryCards
        metrics={data.metrics}
        velocityDays={velocityDays}
        onVelocityDaysChange={handleVelocityDaysChange}
      />

      {/* GPV and Deal Count Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <GpvByStageChart
          data={data.gpvByStage}
          title="Run Rate GPV by Stage"
          dataKey="gpvFullYear"
          onStageClick={handleStageClick}
        />
        <GpvByStageChart
          data={data.gpvByStage}
          title="Deal Count by Stage"
          dataKey="dealCount"
          valueType="number"
          onStageClick={handleStageClick}
        />
      </div>

      {/* Gross Profit Chart */}
      <div className="grid gap-4 md:grid-cols-2">
        <GpvByStageChart
          data={data.gpvByStage}
          title="Gross Profit by Stage"
          dataKey="gpByStage"
          onStageClick={handleStageClick}
        />
      </div>

      {/* Stage Deals Sheet */}
      <StageDealsSheet
        stageId={selectedStage?.stageId || null}
        stageLabel={selectedStage?.stageLabel || ""}
        dealCount={selectedStage?.dealCount || 0}
        open={dealsSheetOpen}
        onOpenChange={setDealsSheetOpen}
      />
    </div>
  );
}
