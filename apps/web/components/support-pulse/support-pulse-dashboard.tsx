"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Headphones } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SummaryCards } from "./summary-cards";
import { VolumeChart } from "./volume-chart";
import { CategoryChart } from "./category-chart";
import { FeedbackScoreCard } from "./feedback-score-card";
import { ResolutionChart } from "./resolution-chart";
import { OwnerTable } from "./owner-table";
import { ClientTable } from "./client-table";
import { TicketList } from "./ticket-list";
import { OwnerDetailModal } from "./owner-detail-modal";
import { FilterChip } from "./filter-chip";
import { TimeFrameSelector } from "./time-frame-selector";
import { DashboardSkeleton } from "./dashboard-skeleton";
import type {
  SupportMetricsResponse,
  SupportPulseFilters,
  TimeFrameDays,
  FeedbackMetrics,
} from "@/types/support-pulse";

export function SupportPulseDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<SupportMetricsResponse | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackMetrics | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  // Time frame state
  const [days, setDays] = useState<TimeFrameDays>(10);
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);

  // Filter state
  const [filters, setFilters] = useState<SupportPulseFilters>({});

  // Drill-down state
  const [showTicketList, setShowTicketList] = useState(false);

  // Owner detail modal state
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!refreshing) setLoading(true);
    setFeedbackLoading(true);

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

      // Fetch main metrics and feedback metrics in parallel
      const [metricsRes, feedbackRes] = await Promise.all([
        fetch(`/api/support/metrics?${params}`),
        fetch(`/api/support/feedback-metrics?${params}`),
      ]);

      if (metricsRes.ok) {
        const json = await metricsRes.json();
        setData(json);
      }

      if (feedbackRes.ok) {
        const json = await feedbackRes.json();
        setFeedbackData(json);
      }
    } catch (error) {
      console.error("Failed to fetch support metrics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setFeedbackLoading(false);
    }
  }, [days, customRange, filters, refreshing]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
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
        <FeedbackScoreCard data={feedbackData} loading={feedbackLoading} />
        <ResolutionChart data={data.resolutionDistribution} />
      </div>

      {/* Tables Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <OwnerTable
          data={data.ownerWorkload}
          onOwnerClick={(ownerId) => {
            setSelectedOwnerId(ownerId);
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

      {/* Owner Detail Modal */}
      <OwnerDetailModal
        ownerId={selectedOwnerId}
        onClose={() => setSelectedOwnerId(null)}
        days={days}
        customRange={customRange}
      />
    </div>
  );
}
