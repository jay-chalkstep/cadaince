"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Headphones, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { SummaryCards } from "./summary-cards";
import { VolumeChart } from "./volume-chart";
import { CategoryChart } from "./category-chart";
import { SourceChart } from "./source-chart";
import { ResolutionChart } from "./resolution-chart";
import { OwnerTable } from "./owner-table";
import { ClientTable } from "./client-table";
import { TicketList } from "./ticket-list";
import { FilterChip } from "./filter-chip";
import { TimeFrameSelector } from "./time-frame-selector";
import { DashboardSkeleton } from "./dashboard-skeleton";
import type {
  SupportMetricsResponse,
  SupportPulseFilters,
  TimeFrameDays,
} from "@/types/support-pulse";

export function SupportPulseDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingOwners, setSyncingOwners] = useState(false);
  const [data, setData] = useState<SupportMetricsResponse | null>(null);
  const { toast } = useToast();

  // Time frame state
  const [days, setDays] = useState<TimeFrameDays>(10);
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);

  // Filter state
  const [filters, setFilters] = useState<SupportPulseFilters>({});

  // Drill-down state
  const [showTicketList, setShowTicketList] = useState(false);

  const fetchData = useCallback(async () => {
    if (!refreshing) setLoading(true);

    try {
      const params = new URLSearchParams();

      if (days !== "custom") {
        params.set("days", String(days));
      } else if (customRange) {
        params.set("start_date", customRange.start.toISOString());
        params.set("end_date", customRange.end.toISOString());
      }

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          const paramKey = key === "ownerId" ? "owner_id" : key === "clientName" ? "client_name" : key;
          params.set(paramKey, value);
        }
      });

      const res = await fetch(`/api/support/metrics?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch support metrics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days, customRange, filters, refreshing]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSyncOwners = async () => {
    setSyncingOwners(true);
    try {
      const res = await fetch("/api/support/sync-owners", { method: "POST" });
      const json = await res.json();

      if (res.ok) {
        toast({
          title: "Owners synced",
          description: `Successfully synced ${json.count} owners from HubSpot.`,
        });
        // Refresh data to show updated owner names
        fetchData();
      } else {
        toast({
          title: "Sync failed",
          description: json.error || "Failed to sync owners from HubSpot.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error syncing owners:", error);
      toast({
        title: "Sync failed",
        description: "An unexpected error occurred while syncing owners.",
        variant: "destructive",
      });
    } finally {
      setSyncingOwners(false);
    }
  };

  const handleFilterChange = (newFilters: Partial<SupportPulseFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const clearFilter = (key: keyof SupportPulseFilters) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
    setShowTicketList(false);
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data || data.summary.totalTickets === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Headphones className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Ticket Data</h3>
          <p className="text-muted-foreground text-center max-w-md mt-1">
            Connect your HubSpot integration and sync ticket data to see support analytics.
          </p>
          <Button asChild className="mt-4">
            <Link href="/settings/integrations">Configure Integration</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {hasActiveFilters && (
            <>
              {filters.category && (
                <FilterChip
                  label={`Category: ${filters.category}`}
                  onClear={() => clearFilter("category")}
                />
              )}
              {filters.source && (
                <FilterChip
                  label={`Source: ${filters.source}`}
                  onClear={() => clearFilter("source")}
                />
              )}
              {filters.ownerId && (
                <FilterChip
                  label={`Owner: ${filters.ownerId}`}
                  onClear={() => clearFilter("ownerId")}
                />
              )}
              {filters.clientName && (
                <FilterChip
                  label={`Client: ${filters.clientName}`}
                  onClear={() => clearFilter("clientName")}
                />
              )}
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Clear all
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <TimeFrameSelector
            value={days}
            onChange={setDays}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncOwners}
            disabled={syncingOwners}
            title="Sync HubSpot owners to display names"
          >
            <Users className={cn("h-4 w-4 mr-2", syncingOwners && "animate-pulse")} />
            {syncingOwners ? "Syncing..." : "Sync Owners"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={data.summary} />

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        <VolumeChart data={data.dailyVolume} />
        <CategoryChart
          data={data.categoryBreakdown}
          onCategoryClick={(category) => {
            handleFilterChange({ category });
            setShowTicketList(true);
          }}
        />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        <SourceChart
          data={data.sourceMix}
          onSourceClick={(source) => {
            handleFilterChange({ source });
            setShowTicketList(true);
          }}
        />
        <ResolutionChart data={data.resolutionDistribution} />
      </div>

      {/* Tables Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <OwnerTable
          data={data.ownerWorkload}
          onOwnerClick={(ownerId) => {
            handleFilterChange({ ownerId });
            setShowTicketList(true);
          }}
        />
        <ClientTable
          data={data.clientVolume}
          onClientClick={(clientName) => {
            handleFilterChange({ clientName });
            setShowTicketList(true);
          }}
        />
      </div>

      {/* Ticket List (Drill-down) */}
      {showTicketList && (
        <TicketList
          filters={filters}
          days={days}
          customRange={customRange}
          onClose={() => setShowTicketList(false)}
        />
      )}
    </div>
  );
}
